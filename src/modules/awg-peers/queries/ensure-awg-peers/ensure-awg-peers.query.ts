import { Query } from '@nestjs/cqrs';

import { TResult } from '@common/types';

import { IAwgInboundRef } from '../../awg-peers.service';

export class EnsureAwgPeersQuery extends Query<TResult<boolean>> {
    constructor(
        public readonly inbounds: IAwgInboundRef[],
        public readonly userIds?: bigint[],
    ) {
        super();
    }
}
