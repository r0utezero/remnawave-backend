import { Logger } from '@nestjs/common';
import { IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';

import { HashedSet } from '@remnawave/hashed-set';
import { StartAwgCommand } from '@remnawave/node-contract';

import { AmneziaWgConfig } from '@common/helpers/awg-config';
import { fail, ok, TResult } from '@common/types';
import { ERRORS } from '@libs/contracts/constants';

import { GetConfigProfileByUuidQuery } from '@modules/config-profiles/queries/get-config-profile-by-uuid';

import { AwgPeersService } from '../../awg-peers.service';
import { AwgPeersRepository } from '../../repositories/awg-peers.repository';
import {
    GetPreparedAwgConfigWithUsersQuery,
    IGetPreparedAwgConfigWithUsersResponse,
} from './get-prepared-awg-config-with-users.query';

@QueryHandler(GetPreparedAwgConfigWithUsersQuery)
export class GetPreparedAwgConfigWithUsersHandler implements IQueryHandler<
    GetPreparedAwgConfigWithUsersQuery,
    TResult<IGetPreparedAwgConfigWithUsersResponse>
> {
    private readonly logger = new Logger(GetPreparedAwgConfigWithUsersHandler.name);

    constructor(
        private readonly awgPeersService: AwgPeersService,
        private readonly awgPeersRepository: AwgPeersRepository,
        private readonly queryBus: QueryBus,
    ) {}

    async execute(
        query: GetPreparedAwgConfigWithUsersQuery,
    ): Promise<TResult<IGetPreparedAwgConfigWithUsersResponse>> {
        const inboundsUserSets: Map<string, HashedSet> = new Map();

        try {
            const { configProfileUuid, activeInbounds } = query;

            const configProfile = await this.queryBus.execute(
                new GetConfigProfileByUuidQuery(configProfileUuid),
            );

            if (!configProfile.isOk) {
                return fail(ERRORS.INTERNAL_SERVER_ERROR);
            }

            const awgInbounds = AwgPeersService.filterAwgInbounds(activeInbounds);
            const activeTags = new Set(awgInbounds.map((inbound) => inbound.tag));

            const config = new AmneziaWgConfig(configProfile.response.config as object);
            const interfaces = config.getInterfaces(activeTags);

            await this.awgPeersService.ensurePeers(awgInbounds);

            const peers: StartAwgCommand.Request['awgConfig']['peers'] = [];

            for await (const batch of this.awgPeersRepository.streamPeersForConfig(
                awgInbounds.map((inbound) => inbound.uuid),
            )) {
                for (const row of batch) {
                    peers.push({
                        tag: row.inboundTag,
                        username: row.userId.toString(),
                        hashUuid: row.vlessUuid,
                        publicKey: row.awgPublicKey,
                        presharedKey: row.awgPresharedKey,
                        allowedIp: row.ip,
                    });

                    let set = inboundsUserSets.get(row.inboundTag);
                    if (!set) {
                        set = new HashedSet();
                        inboundsUserSets.set(row.inboundTag, set);
                    }
                    set.add(row.vlessUuid);
                }
            }

            return ok({
                awgConfig: {
                    interfaces: interfaces.map((iface) => ({
                        tag: iface.tag,
                        listenPort: iface.listenPort,
                        privateKey: iface.privateKey,
                        address: iface.address,
                        mtu: iface.mtu,
                        obfuscation: iface.obfuscation,
                    })),
                    peers,
                },
                hashesPayload: {
                    emptyConfig: new AmneziaWgConfig({ interfaces }).getConfigHash(),
                    inbounds: Array.from(inboundsUserSets.entries()).map(([tag, set]) => ({
                        usersCount: set.size,
                        hash: set.hash64String,
                        tag,
                    })),
                },
            });
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        } finally {
            for (const [, set] of inboundsUserSets) {
                set.clear();
            }
            inboundsUserSets.clear();
        }
    }
}
