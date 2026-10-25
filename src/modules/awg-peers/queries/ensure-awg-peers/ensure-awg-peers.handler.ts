import { Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { fail, ok, TResult } from '@common/types';
import { ERRORS } from '@libs/contracts/constants';

import { AwgPeersService } from '../../awg-peers.service';
import { EnsureAwgPeersQuery } from './ensure-awg-peers.query';

@QueryHandler(EnsureAwgPeersQuery)
export class EnsureAwgPeersHandler implements IQueryHandler<EnsureAwgPeersQuery, TResult<boolean>> {
    private readonly logger = new Logger(EnsureAwgPeersHandler.name);

    constructor(private readonly awgPeersService: AwgPeersService) {}

    async execute(query: EnsureAwgPeersQuery): Promise<TResult<boolean>> {
        try {
            await this.awgPeersService.ensurePeers(query.inbounds, query.userIds);

            return ok(true);
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }
}
