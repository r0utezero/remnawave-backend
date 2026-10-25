import { Query } from '@nestjs/cqrs';

import { TResult } from '@common/types';

import { IAwgInboundRef } from '../../awg-peers.service';
import { IAwgUserData } from '../../repositories/awg-peers.repository';

export class GetUserAwgPeersQuery extends Query<TResult<IAwgUserData>> {
    constructor(
        public readonly userId: bigint,
        public readonly inbounds: IAwgInboundRef[],
    ) {
        super();
    }
}
