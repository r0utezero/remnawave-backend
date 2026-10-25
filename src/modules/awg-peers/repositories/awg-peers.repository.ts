import { USERS_STATUS } from '@contract/constants';
import { sql } from 'kysely';

import { Injectable, Logger } from '@nestjs/common';

import { TxKyselyService } from '@common/database';
import { getKyselyUuid } from '@common/helpers';
import { values } from '@common/helpers/kysely/values';
import { formatExecutionTime, getTime } from '@common/utils/get-elapsed-time';

export interface IAwgUserKeys {
    id: bigint;
    awgPrivateKey: string;
    awgPublicKey: string;
    awgPresharedKey: string;
}

export interface IAwgPeerForConfig {
    userId: bigint;
    vlessUuid: string;
    awgPublicKey: string;
    awgPresharedKey: string | null;
    inboundTag: string;
    ip: string;
}

export interface IAwgUserData {
    awgPrivateKey: string | null;
    awgPublicKey: string | null;
    awgPresharedKey: string | null;
    peers: Array<{ inboundUuid: string; ip: string }>;
}

@Injectable()
export class AwgPeersRepository {
    private readonly logger = new Logger(AwgPeersRepository.name);

    constructor(private readonly qb: TxKyselyService) {}

    /**
     * Users that have access to any of the inbounds (via internal squads) but have no AWG keys yet.
     * When `userIds` is passed, status is not checked.
     */
    public async findUserIdsMissingKeys(
        inboundUuids: string[],
        userIds: bigint[] | undefined,
        limit: number,
    ): Promise<bigint[]> {
        if (inboundUuids.length === 0) return [];

        const result = await this.qb.kysely
            .selectFrom('users')
            .innerJoin('internalSquadMembers', 'internalSquadMembers.userId', 'users.id')
            .innerJoin(
                'internalSquadInbounds',
                'internalSquadInbounds.internalSquadUuid',
                'internalSquadMembers.internalSquadUuid',
            )
            .where(
                'internalSquadInbounds.inboundUuid',
                'in',
                inboundUuids.map((uuid) => getKyselyUuid(uuid)),
            )
            .where('users.awgPublicKey', 'is', null)
            .$if(userIds !== undefined, (qb) => qb.where('users.id', 'in', userIds!))
            .$if(userIds === undefined, (qb) => qb.where('users.status', '=', USERS_STATUS.ACTIVE))
            .select('users.id')
            .distinct()
            .limit(limit)
            .execute();

        return result.map((row) => row.id);
    }

    public async setUserKeys(rows: IAwgUserKeys[]): Promise<void> {
        if (rows.length === 0) return;

        await this.qb.kysely
            .updateTable('users')
            .from(
                values(
                    rows.map((row) => ({
                        id: sql`${row.id}::bigint`,
                        priv: row.awgPrivateKey,
                        pub: row.awgPublicKey,
                        psk: row.awgPresharedKey,
                    })),
                    'v',
                ),
            )
            .set((eb) => ({
                awgPrivateKey: eb.ref('v.priv'),
                awgPublicKey: eb.ref('v.pub'),
                awgPresharedKey: eb.ref('v.psk'),
            }))
            .whereRef('users.id', '=', 'v.id')
            .where('users.awgPublicKey', 'is', null)
            .execute();
    }

    /**
     * Users that have access to the inbound but have no peer (IP) on it yet.
     */
    public async findUserIdsMissingPeer(
        inboundUuid: string,
        userIds: bigint[] | undefined,
        limit: number,
    ): Promise<bigint[]> {
        const result = await this.qb.kysely
            .selectFrom('users')
            .innerJoin('internalSquadMembers', 'internalSquadMembers.userId', 'users.id')
            .innerJoin(
                'internalSquadInbounds',
                'internalSquadInbounds.internalSquadUuid',
                'internalSquadMembers.internalSquadUuid',
            )
            .leftJoin('userAwgPeers', (join) =>
                join
                    .onRef('userAwgPeers.userId', '=', 'users.id')
                    .on('userAwgPeers.inboundUuid', '=', getKyselyUuid(inboundUuid)),
            )
            .where('internalSquadInbounds.inboundUuid', '=', getKyselyUuid(inboundUuid))
            .where('userAwgPeers.userId', 'is', null)
            .$if(userIds !== undefined, (qb) => qb.where('users.id', 'in', userIds!))
            .$if(userIds === undefined, (qb) => qb.where('users.status', '=', USERS_STATUS.ACTIVE))
            .select('users.id')
            .distinct()
            .orderBy('users.id', 'asc')
            .limit(limit)
            .execute();

        return result.map((row) => row.id);
    }

    public async findUsedIps(inboundUuid: string): Promise<Set<string>> {
        const result = await this.qb.kysely
            .selectFrom('userAwgPeers')
            .select(sql<string>`host(ip)`.as('ip'))
            .where('inboundUuid', '=', getKyselyUuid(inboundUuid))
            .execute();

        return new Set(result.map((row) => row.ip));
    }

    public async insertPeers(
        rows: Array<{ userId: bigint; inboundUuid: string; ip: string }>,
    ): Promise<number> {
        if (rows.length === 0) return 0;

        const result = await this.qb.kysely
            .insertInto('userAwgPeers')
            .values(
                rows.map((row) => ({
                    userId: row.userId,
                    inboundUuid: getKyselyUuid(row.inboundUuid),
                    ip: sql<string>`${row.ip}::inet`,
                })),
            )
            .onConflict((oc) => oc.doNothing())
            .executeTakeFirst();

        return Number(result.numInsertedOrUpdatedRows ?? 0n);
    }

    public async *streamPeersForConfig(
        inboundUuids: string[],
    ): AsyncGenerator<IAwgPeerForConfig[]> {
        const BATCH_SIZE = 50_000;
        let lastUserId: bigint | null = null;

        if (inboundUuids.length === 0) return;

        while (true) {
            const startTime = getTime();

            const result: IAwgPeerForConfig[] = await this.qb.kysely
                .selectFrom('users')
                .innerJoin('userAwgPeers', 'userAwgPeers.userId', 'users.id')
                .innerJoin(
                    'configProfileInbounds',
                    'configProfileInbounds.uuid',
                    'userAwgPeers.inboundUuid',
                )
                .where('users.status', '=', USERS_STATUS.ACTIVE)
                .where('users.awgPublicKey', 'is not', null)
                .where(
                    'userAwgPeers.inboundUuid',
                    'in',
                    inboundUuids.map((uuid) => getKyselyUuid(uuid)),
                )
                .where(({ exists, selectFrom }) =>
                    exists(
                        selectFrom('internalSquadMembers')
                            .innerJoin(
                                'internalSquadInbounds',
                                'internalSquadInbounds.internalSquadUuid',
                                'internalSquadMembers.internalSquadUuid',
                            )
                            .whereRef('internalSquadMembers.userId', '=', 'users.id')
                            .whereRef(
                                'internalSquadInbounds.inboundUuid',
                                '=',
                                'userAwgPeers.inboundUuid',
                            )
                            .select(sql`1`.as('one')),
                    ),
                )
                .$if(lastUserId !== null, (qb) => qb.where('users.id', '>', lastUserId!))
                .select([
                    'users.id as userId',
                    'users.vlessUuid',
                    sql<string>`users.awg_public_key`.as('awgPublicKey'),
                    'users.awgPresharedKey',
                    'configProfileInbounds.tag as inboundTag',
                    sql<string>`host(user_awg_peers.ip)`.as('ip'),
                ])
                .orderBy('users.id', 'asc')
                .limit(BATCH_SIZE)
                .execute();

            this.logger.log(
                `[streamPeersForConfig] ${formatExecutionTime(startTime)}, length: ${result.length}`,
            );

            if (result.length === 0) break;

            lastUserId = result[result.length - 1].userId;

            // a user may have several peers (one per inbound) - do not split them between batches
            if (result.length === BATCH_SIZE) {
                const tail = result.filter((row) => row.userId === lastUserId);
                const head = result.filter((row) => row.userId !== lastUserId);

                if (head.length > 0) {
                    lastUserId = head[head.length - 1].userId;
                    yield head;
                    continue;
                }

                yield tail;
                continue;
            }

            yield result;
            break;
        }
    }

    public async getUsersAwgData(
        userIds: bigint[],
        inboundUuids: string[],
    ): Promise<Map<bigint, IAwgUserData>> {
        const result = new Map<bigint, IAwgUserData>();

        if (userIds.length === 0) return result;

        const users = await this.qb.kysely
            .selectFrom('users')
            .select(['id', 'awgPrivateKey', 'awgPublicKey', 'awgPresharedKey'])
            .where('id', 'in', userIds)
            .execute();

        for (const user of users) {
            result.set(user.id, {
                awgPrivateKey: user.awgPrivateKey,
                awgPublicKey: user.awgPublicKey,
                awgPresharedKey: user.awgPresharedKey,
                peers: [],
            });
        }

        if (inboundUuids.length === 0) return result;

        const peers = await this.qb.kysely
            .selectFrom('userAwgPeers')
            .select([
                'userId',
                sql<string>`inbound_uuid::text`.as('inboundUuid'),
                sql<string>`host(ip)`.as('ip'),
            ])
            .where('userId', 'in', userIds)
            .where(
                'inboundUuid',
                'in',
                inboundUuids.map((uuid) => getKyselyUuid(uuid)),
            )
            .execute();

        for (const peer of peers) {
            result.get(peer.userId)?.peers.push({ inboundUuid: peer.inboundUuid, ip: peer.ip });
        }

        return result;
    }

    public async getUserAwgData(userId: bigint, inboundUuids: string[]): Promise<IAwgUserData> {
        const user = await this.qb.kysely
            .selectFrom('users')
            .select(['awgPrivateKey', 'awgPublicKey', 'awgPresharedKey'])
            .where('id', '=', userId)
            .executeTakeFirst();

        const peers =
            inboundUuids.length === 0
                ? []
                : await this.qb.kysely
                      .selectFrom('userAwgPeers')
                      .select([
                          sql<string>`inbound_uuid::text`.as('inboundUuid'),
                          sql<string>`host(ip)`.as('ip'),
                      ])
                      .where('userId', '=', userId)
                      .where(
                          'inboundUuid',
                          'in',
                          inboundUuids.map((uuid) => getKyselyUuid(uuid)),
                      )
                      .execute();

        return {
            awgPrivateKey: user?.awgPrivateKey ?? null,
            awgPublicKey: user?.awgPublicKey ?? null,
            awgPresharedKey: user?.awgPresharedKey ?? null,
            peers,
        };
    }
}
