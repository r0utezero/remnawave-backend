import { Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { fail, ok, TResult } from '@common/types';
import { ERRORS } from '@libs/contracts/constants';

import { AwgPeersService } from '../../awg-peers.service';
import { IAwgUserData } from '../../repositories/awg-peers.repository';
import { GetUsersAwgPeersQuery } from './get-users-awg-peers.query';

@QueryHandler(GetUsersAwgPeersQuery)
export class GetUsersAwgPeersHandler implements IQueryHandler<
    GetUsersAwgPeersQuery,
    TResult<Map<bigint, IAwgUserData>>
> {
    private readonly logger = new Logger(GetUsersAwgPeersHandler.name);

    constructor(private readonly awgPeersService: AwgPeersService) {}

    async execute(query: GetUsersAwgPeersQuery): Promise<TResult<Map<bigint, IAwgUserData>>> {
        try {
            return ok(await this.awgPeersService.getUsersAwgData(query.userIds, query.inbounds));
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }
}
