import { hasher } from 'node-object-hash';

import { AMNEZIAWG_INBOUND_TYPE } from '@libs/contracts/constants';
import {
    AwgProfileConfigSchema,
    TAwgProfileConfig,
    TAwgProfileInterface,
    TAwgRawInbound,
} from '@libs/contracts/models';

import { parseAwgSubnet } from './awg-ip.util';
import { deriveAwgPublicKey } from './awg-keys';

interface IAwgInboundWithTagsAndType {
    tag: string;
    type: string;
    network: string | null;
    security: string | null;
    port: number | null;
    rawInbound: TAwgRawInbound;
}

type TCtrAwgConfig = object | Record<string, unknown> | string;

export class AmneziaWgConfig {
    private config: TAwgProfileConfig;

    constructor(configInput: TCtrAwgConfig) {
        this.config = this.parseConfig(configInput);
        this.validate();
    }

    public getConfig(): TAwgProfileConfig {
        return this.config;
    }

    public getSortedConfig(): TAwgProfileConfig {
        return this.config;
    }

    public getConfigHash(): string {
        const hash = hasher({ trim: true, sort: true }).hash;
        return hash(this.config);
    }

    public getInterfaces(tags?: Set<string>): TAwgProfileInterface[] {
        if (!tags) return this.config.interfaces;

        return this.config.interfaces.filter((iface) => tags.has(iface.tag));
    }

    public getInterface(tag: string): TAwgProfileInterface | undefined {
        return this.config.interfaces.find((iface) => iface.tag === tag);
    }

    public getAllInbounds(): IAwgInboundWithTagsAndType[] {
        return this.config.interfaces.map((iface) => {
            const { privateKey, ...rest } = iface;

            return {
                tag: iface.tag,
                type: AMNEZIAWG_INBOUND_TYPE,
                network: 'udp',
                security: null,
                port: iface.listenPort,
                rawInbound: {
                    ...rest,
                    protocol: AMNEZIAWG_INBOUND_TYPE,
                    publicKey: deriveAwgPublicKey(privateKey),
                },
            };
        });
    }

    private parseConfig(configInput: TCtrAwgConfig): TAwgProfileConfig {
        let raw: unknown = configInput;

        if (typeof configInput === 'string') {
            try {
                raw = JSON.parse(configInput);
            } catch (error) {
                throw new Error(`Invalid JSON input or file path: ${error}`);
            }
        }

        const parsed = AwgProfileConfigSchema.safeParse(raw);

        if (!parsed.success) {
            throw new Error(
                `Invalid AmneziaWG config: ${parsed.error.issues
                    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                    .join('; ')}`,
            );
        }

        return parsed.data;
    }

    private validate(): void {
        const tags = new Set<string>();
        const ports = new Set<number>();
        const subnets = new Set<string>();

        for (const iface of this.config.interfaces) {
            if (tags.has(iface.tag)) {
                throw new Error(`Duplicate interface tag: ${iface.tag}`);
            }
            tags.add(iface.tag);

            if (ports.has(iface.listenPort)) {
                throw new Error(`Duplicate listenPort: ${iface.listenPort}`);
            }
            ports.add(iface.listenPort);

            const { network, serverIp } = parseAwgSubnet(iface.address);

            if (serverIp === network.split('/')[0]) {
                throw new Error(
                    `Interface ${iface.tag}: address must be a host address, not the network address`,
                );
            }

            if (subnets.has(network)) {
                throw new Error(`Duplicate subnet ${network} in interface ${iface.tag}`);
            }
            subnets.add(network);

            deriveAwgPublicKey(iface.privateKey);
        }
    }
}
