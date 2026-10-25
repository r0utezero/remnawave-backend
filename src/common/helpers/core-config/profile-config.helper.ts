import { CORE_TYPE, TCoreType } from '@libs/contracts/constants';

import { AmneziaWgConfig } from '../awg-config/awg-config.validator';
import { XRayConfig } from '../xray-config/xray-config.validator';

export interface IParsedProfileInbound {
    tag: string;
    type: string;
    network: string | null;
    security: string | null;
    port: number | null;
    rawInbound: object | null;
}

export interface IParsedProfileConfig {
    sortedConfig: object;
    inbounds: IParsedProfileInbound[];
}

export function getSortedProfileConfig(coreType: TCoreType, config: unknown): object {
    if (coreType === CORE_TYPE.AMNEZIAWG) {
        return new AmneziaWgConfig(config as object).getSortedConfig();
    }

    return new XRayConfig(config as object).getSortedConfig() as object;
}

/**
 * Validates profile config for the given core and extracts managed inbounds.
 * `normalize` applies the extra Xray cleanups used on profile update.
 */
export function parseProfileConfig(
    coreType: TCoreType,
    config: object,
    normalize = false,
): IParsedProfileConfig {
    if (coreType === CORE_TYPE.AMNEZIAWG) {
        const awgConfig = new AmneziaWgConfig(config);

        return {
            sortedConfig: awgConfig.getSortedConfig(),
            inbounds: awgConfig.getAllInbounds(),
        };
    }

    const xrayConfig = new XRayConfig(config);

    if (normalize) {
        xrayConfig.cleanInboundClients(false);
        xrayConfig.fixIncorrectServerNames();
        xrayConfig.validateOutbounds();
    }

    return {
        sortedConfig: xrayConfig.getSortedConfig() as object,
        inbounds: xrayConfig.getAllInbounds(),
    };
}
