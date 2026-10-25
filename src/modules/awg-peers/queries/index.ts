import { EnsureAwgPeersHandler } from './ensure-awg-peers';
import { GetPreparedAwgConfigWithUsersHandler } from './get-prepared-awg-config-with-users';
import { GetUserAwgPeersHandler } from './get-user-awg-peers';
import { GetUsersAwgPeersHandler } from './get-users-awg-peers';

export const QUERIES = [
    EnsureAwgPeersHandler,
    GetPreparedAwgConfigWithUsersHandler,
    GetUserAwgPeersHandler,
    GetUsersAwgPeersHandler,
];
