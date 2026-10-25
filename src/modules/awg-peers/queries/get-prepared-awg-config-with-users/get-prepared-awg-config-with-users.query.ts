import { Query } from '@nestjs/cqrs';

import { StartAwgCommand } from '@remnawave/node-contract';

import { TResult } from '@common/types';

import { ConfigProfileInboundEntity } from '@modules/config-profiles/entities';

export interface IGetPreparedAwgConfigWithUsersResponse {
    awgConfig: StartAwgCommand.Request['awgConfig'];
    hashesPayload: StartAwgCommand.Request['internals']['hashes'];
}

export class GetPreparedAwgConfigWithUsersQuery extends Query<
    TResult<IGetPreparedAwgConfigWithUsersResponse>
> {
    constructor(
        public readonly configProfileUuid: string,
        public readonly activeInbounds: ConfigProfileInboundEntity[],
    ) {
        super();
    }
}
