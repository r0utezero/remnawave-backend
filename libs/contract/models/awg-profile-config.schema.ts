import { z } from 'zod';

const AwgHeaderSchema = z
    .string()
    .regex(/^\d+(-\d+)?$/, 'Header must be a number or a range like 100-200');

export const AwgObfuscationSchema = z
    .object({
        jc: z.int().min(0).max(128),
        jmin: z.int().min(0).max(1280),
        jmax: z.int().min(0).max(1280),
        s1: z.int().min(0).max(1280),
        s2: z.int().min(0).max(1280),
        s3: z.optional(z.int().min(0).max(1280)),
        s4: z.optional(z.int().min(0).max(1280)),
        h1: AwgHeaderSchema,
        h2: AwgHeaderSchema,
        h3: AwgHeaderSchema,
        h4: AwgHeaderSchema,
        i1: z.optional(z.string()),
        i2: z.optional(z.string()),
        i3: z.optional(z.string()),
        i4: z.optional(z.string()),
        i5: z.optional(z.string()),
    })
    .refine((o) => o.jmin <= o.jmax, { message: 'jmin must be less than or equal to jmax' });

export const AwgProfileInterfaceSchema = z.object({
    tag: z
        .string()
        .min(1)
        .regex(/^[A-Za-z0-9_.-]+$/, 'Tag can only contain letters, numbers, _, . and -'),
    listenPort: z.int().min(1).max(65535),
    privateKey: z.base64().length(44, 'privateKey must be a base64 encoded 32-byte key'),
    address: z
        .string()
        .regex(
            /^(\d{1,3}\.){3}\d{1,3}\/(1[6-9]|2[0-9]|30)$/,
            'address must be an IPv4 CIDR with prefix /16-/30, e.g. 10.8.0.1/24',
        ),
    mtu: z.optional(z.int().min(576).max(65535)),
    clientDns: z.optional(z.array(z.string())),
    clientAllowedIps: z.optional(z.array(z.string())),
    persistentKeepalive: z.optional(z.int().min(0).max(65535)),
    obfuscation: AwgObfuscationSchema,
});

export const AwgProfileConfigSchema = z.object({
    interfaces: z.array(AwgProfileInterfaceSchema).min(1),
});

/**
 * What is stored in ConfigProfileInbounds.rawInbound for AmneziaWG inbounds.
 * Same as interface, but privateKey is replaced with publicKey.
 */
export const AwgRawInboundSchema = AwgProfileInterfaceSchema.omit({ privateKey: true }).extend({
    protocol: z.literal('amneziawg'),
    publicKey: z.string(),
});

export type TAwgObfuscation = z.infer<typeof AwgObfuscationSchema>;
export type TAwgProfileInterface = z.infer<typeof AwgProfileInterfaceSchema>;
export type TAwgProfileConfig = z.infer<typeof AwgProfileConfigSchema>;
export type TAwgRawInbound = z.infer<typeof AwgRawInboundSchema>;
