function ipToInt(ip: string): number {
    return ip.split('.').reduce((acc, octet) => ((acc << 8) + Number(octet)) >>> 0, 0) >>> 0;
}

function intToIp(value: number): string {
    return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

export interface IAwgSubnet {
    serverIp: string;
    prefix: number;
    network: string;
    firstHost: number;
    lastHost: number;
}

export function parseAwgSubnet(address: string): IAwgSubnet {
    const [ip, prefixRaw] = address.split('/');
    const prefix = Number(prefixRaw);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const network = (ipToInt(ip) & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;

    return {
        serverIp: ip,
        prefix,
        network: `${intToIp(network)}/${prefix}`,
        firstHost: network + 1,
        lastHost: broadcast - 1,
    };
}

export function stripIpMask(ip: string): string {
    return ip.split('/')[0];
}

/**
 * Picks `count` lowest free host addresses in the subnet, skipping the server address.
 */
export function pickFreeAwgIps(address: string, usedIps: Set<string>, count: number): string[] {
    const subnet = parseAwgSubnet(address);
    const serverInt = ipToInt(subnet.serverIp);
    const result: string[] = [];

    for (let cur = subnet.firstHost; cur <= subnet.lastHost && result.length < count; cur++) {
        if (cur === serverInt) continue;

        const ip = intToIp(cur);

        if (!usedIps.has(ip)) {
            result.push(ip);
        }
    }

    return result;
}
