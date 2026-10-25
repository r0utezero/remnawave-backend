import { ConfigProfiles } from '@prisma/client';

import { TCoreType } from '@libs/contracts/constants';

export class ConfigProfileEntity implements ConfigProfiles {
    public uuid: string;
    public viewPosition: number;
    public name: string;
    public tags: string[];
    public config: object;
    public coreType: TCoreType;

    public createdAt: Date;
    public updatedAt: Date;

    constructor(configProfile: Partial<ConfigProfiles>) {
        Object.assign(this, configProfile);
        return this;
    }
}
