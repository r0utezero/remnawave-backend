import { TAwgObfuscation } from '@libs/contracts/models';

import { IResolvedAwgConfig } from '../../resolve-proxy/interfaces';

const OBFUSCATION_KEYS: Array<[keyof TAwgObfuscation, string]> = [
    ['jc', 'Jc'],
    ['jmin', 'Jmin'],
    ['jmax', 'Jmax'],
    ['s1', 'S1'],
    ['s2', 'S2'],
    ['s3', 'S3'],
    ['s4', 'S4'],
    ['h1', 'H1'],
    ['h2', 'H2'],
    ['h3', 'H3'],
    ['h4', 'H4'],
    ['i1', 'I1'],
    ['i2', 'I2'],
    ['i3', 'I3'],
    ['i4', 'I4'],
    ['i5', 'I5'],
];

function formatEndpoint(address: string, port: number): string {
    return address.includes(':') && !address.startsWith('[')
        ? `[${address}]:${port}`
        : `${address}:${port}`;
}

/**
 * Client-side AmneziaWG .conf (the format the AmneziaWG/AmneziaVPN apps import).
 */
export function buildAwgConf(config: IResolvedAwgConfig): string {
    const lines = [
        '[Interface]',
        `PrivateKey = ${config.privateKey}`,
        `Address = ${config.clientIp}/32`,
    ];

    if (config.dns.length > 0) {
        lines.push(`DNS = ${config.dns.join(', ')}`);
    }

    if (config.mtu) {
        lines.push(`MTU = ${config.mtu}`);
    }

    for (const [key, confKey] of OBFUSCATION_KEYS) {
        const value = config.obfuscation[key];

        if (value === undefined || value === null || value === '') continue;

        lines.push(`${confKey} = ${value}`);
    }

    lines.push('', '[Peer]', `PublicKey = ${config.serverPublicKey}`);

    if (config.presharedKey) {
        lines.push(`PresharedKey = ${config.presharedKey}`);
    }

    lines.push(
        `AllowedIPs = ${config.allowedIps.join(', ')}`,
        `Endpoint = ${formatEndpoint(config.address, config.port)}`,
    );

    if (config.persistentKeepalive) {
        lines.push(`PersistentKeepalive = ${config.persistentKeepalive}`);
    }

    return lines.join('\n') + '\n';
}

/**
 * awg://<base64url(conf)>#<remark> - understood by INCY and compatible clients.
 */
export function buildAwgLink(config: IResolvedAwgConfig): string {
    const conf = Buffer.from(buildAwgConf(config)).toString('base64url');

    return `awg://${conf}#${encodeURIComponent(config.finalRemark)}`;
}
