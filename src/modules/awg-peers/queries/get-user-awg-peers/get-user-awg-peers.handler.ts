import { Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { fail, ok, TResult } from '@common/types';
import { ERRORS } from '@libs/contracts/constants';

import { AwgPeersService } from '../../awg-peers.service';
import { IAwgUserData } from '../../repositories/awg-peers.repository';
import { GetUserAwgPeersQuery } from './get-user-awg-peers.query';

@QueryHandler(GetUserAwgPeersQuery)
export class GetUserAwgPeersHandler implements IQueryHandler<
    GetUserAwgPeersQuery,
    TResult<IAwgUserData>
> {
    private readonly logger = new Logger(GetUserAwgPeersHandler.name);

    constructor(private readonly awgPeersService: AwgPeersService) {}

    async execute(query: GetUserAwgPeersQuery): Promise<TResult<IAwgUserData>> {
        try {
            return ok(await this.awgPeersService.getUserAwgData(query.userId, query.inbounds));
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }
}
