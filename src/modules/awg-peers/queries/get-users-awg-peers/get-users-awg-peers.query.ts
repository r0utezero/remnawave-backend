import { Query } from '@nestjs/cqrs';

import { TResult } from '@common/types';

import { IAwgInboundRef } from '../../awg-peers.service';
import { IAwgUserData } from '../../repositories/awg-peers.repository';

export class GetUsersAwgPeersQuery extends Query<TResult<Map<bigint, IAwgUserData>>> {
    constructor(
        public readonly userIds: bigint[],
        public readonly inbounds: IAwgInboundRef[],
    ) {
        super();
    }
}
