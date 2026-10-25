import { Injectable, Logger } from '@nestjs/common';

import {
    generateAwgKeyPair,
    generateAwgPresharedKey,
    pickFreeAwgIps,
} from '@common/helpers/awg-config';
import { AMNEZIAWG_INBOUND_TYPE } from '@libs/contracts/constants';

import { AwgPeersRepository, IAwgUserData } from './repositories/awg-peers.repository';

export interface IAwgInboundRef {
    uuid: string;
    tag: string;
    type: string;
    rawInbound: unknown;
}

const KEYS_BATCH_SIZE = 10_000;
const PEERS_BATCH_SIZE = 50_000;
const MAX_ALLOCATION_ATTEMPTS = 3;

@Injectable()
export class AwgPeersService {
    private readonly logger = new Logger(AwgPeersService.name);

    constructor(private readonly awgPeersRepository: AwgPeersRepository) {}

    public static filterAwgInbounds<T extends IAwgInboundRef>(inbounds: T[]): T[] {
        return inbounds.filter((inbound) => inbound.type === AMNEZIAWG_INBOUND_TYPE);
    }

    /**
     * Makes sure every eligible user has AWG keys and an IP on each of the given AWG inbounds.
     * Without `userIds` all ACTIVE users with access to the inbounds are processed.
     */
    public async ensurePeers(inbounds: IAwgInboundRef[], userIds?: bigint[]): Promise<void> {
        const awgInbounds = AwgPeersService.filterAwgInbounds(inbounds);

        if (awgInbounds.length === 0) return;

        await this.ensureKeys(
            awgInbounds.map((inbound) => inbound.uuid),
            userIds,
        );

        for (const inbound of awgInbounds) {
            await this.ensureInboundPeers(inbound, userIds);
        }
    }

    public async getUserAwgData(userId: bigint, inbounds: IAwgInboundRef[]): Promise<IAwgUserData> {
        const awgInbounds = AwgPeersService.filterAwgInbounds(inbounds);

        await this.ensurePeers(awgInbounds, [userId]);

        return this.awgPeersRepository.getUserAwgData(
            userId,
            awgInbounds.map((inbound) => inbound.uuid),
        );
    }

    public async getUsersAwgData(
        userIds: bigint[],
        inbounds: IAwgInboundRef[],
    ): Promise<Map<bigint, IAwgUserData>> {
        const awgInbounds = AwgPeersService.filterAwgInbounds(inbounds);

        await this.ensurePeers(awgInbounds, userIds);

        return this.awgPeersRepository.getUsersAwgData(
            userIds,
            awgInbounds.map((inbound) => inbound.uuid),
        );
    }

    private async ensureKeys(inboundUuids: string[], userIds?: bigint[]): Promise<void> {
        while (true) {
            const missing = await this.awgPeersRepository.findUserIdsMissingKeys(
                inboundUuids,
                userIds,
                KEYS_BATCH_SIZE,
            );

            if (missing.length === 0) return;

            await this.awgPeersRepository.setUserKeys(
                missing.map((id) => {
                    const keyPair = generateAwgKeyPair();

                    return {
                        id,
                        awgPrivateKey: keyPair.privateKey,
                        awgPublicKey: keyPair.publicKey,
                        awgPresharedKey: generateAwgPresharedKey(),
                    };
                }),
            );

            this.logger.log(`Generated AmneziaWG keys for ${missing.length} users`);

            if (missing.length < KEYS_BATCH_SIZE) return;
        }
    }

    private async ensureInboundPeers(inbound: IAwgInboundRef, userIds?: bigint[]): Promise<void> {
        const address = this.getInboundAddress(inbound);

        if (!address) {
            this.logger.warn(`AmneziaWG inbound ${inbound.tag} has no address, skipping`);
            return;
        }

        let attempts = 0;

        while (attempts < MAX_ALLOCATION_ATTEMPTS) {
            const missing = await this.awgPeersRepository.findUserIdsMissingPeer(
                inbound.uuid,
                userIds,
                PEERS_BATCH_SIZE,
            );

            if (missing.length === 0) return;

            const usedIps = await this.awgPeersRepository.findUsedIps(inbound.uuid);
            const freeIps = pickFreeAwgIps(address, usedIps, missing.length);

            if (freeIps.length < missing.length) {
                this.logger.error(
                    `AmneziaWG subnet ${address} of ${inbound.tag} is exhausted: ` +
                        `${missing.length - freeIps.length} users left without an IP`,
                );
            }

            if (freeIps.length === 0) return;

            const inserted = await this.awgPeersRepository.insertPeers(
                freeIps.map((ip, index) => ({
                    userId: missing[index],
                    inboundUuid: inbound.uuid,
                    ip,
                })),
            );

            // conflicts mean a concurrent allocation took some IPs - retry for the rest
            if (inserted < freeIps.length) {
                attempts++;
                continue;
            }

            if (missing.length < PEERS_BATCH_SIZE || freeIps.length < missing.length) return;
        }
    }

    private getInboundAddress(inbound: IAwgInboundRef): string | null {
        const raw = inbound.rawInbound;

        if (raw && typeof raw === 'object' && 'address' in raw && typeof raw.address === 'string') {
            return raw.address;
        }

        return null;
    }
}
