export const CORE_TYPE = {
    XRAY: 'XRAY',
    AMNEZIAWG: 'AMNEZIAWG',
} as const;

export type TCoreType = (typeof CORE_TYPE)[keyof typeof CORE_TYPE];
export const CORE_TYPE_VALUES = Object.values(CORE_TYPE);

export const AMNEZIAWG_INBOUND_TYPE = 'amneziawg' as const;
