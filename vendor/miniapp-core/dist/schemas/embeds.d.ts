import { z } from 'zod';
export declare const actionLaunchFrameSchema: z.ZodObject<{
    type: z.ZodLiteral<"launch_frame">;
    name: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    splashImageUrl: z.ZodOptional<z.ZodString>;
    splashBackgroundColor: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const actionLaunchMiniAppSchema: z.ZodObject<{
    type: z.ZodLiteral<"launch_miniapp">;
    name: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    splashImageUrl: z.ZodOptional<z.ZodString>;
    splashBackgroundColor: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const actionViewTokenSchema: z.ZodObject<{
    type: z.ZodLiteral<"view_token">;
    token: z.ZodString;
}, z.core.$strip>;
export declare const actionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"launch_miniapp">;
    name: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    splashImageUrl: z.ZodOptional<z.ZodString>;
    splashBackgroundColor: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"view_token">;
    token: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"launch_frame">;
    name: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    splashImageUrl: z.ZodOptional<z.ZodString>;
    splashBackgroundColor: z.ZodOptional<z.ZodString>;
}, z.core.$strip>], "type">;
export declare const buttonSchema: z.ZodObject<{
    title: z.ZodString;
    action: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"launch_miniapp">;
        name: z.ZodString;
        url: z.ZodOptional<z.ZodString>;
        splashImageUrl: z.ZodOptional<z.ZodString>;
        splashBackgroundColor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"view_token">;
        token: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"launch_frame">;
        name: z.ZodString;
        url: z.ZodOptional<z.ZodString>;
        splashImageUrl: z.ZodOptional<z.ZodString>;
        splashBackgroundColor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>], "type">;
}, z.core.$strip>;
export declare const miniAppEmbedNextSchema: z.ZodObject<{
    version: z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>, z.ZodUnion<readonly [z.ZodLiteral<"next">, z.ZodLiteral<"1">]>>;
    imageUrl: z.ZodString;
    aspectRatio: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<"1:1">, z.ZodLiteral<"3:2">]>>;
    button: z.ZodObject<{
        title: z.ZodString;
        action: z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"launch_miniapp">;
            name: z.ZodString;
            url: z.ZodOptional<z.ZodString>;
            splashImageUrl: z.ZodOptional<z.ZodString>;
            splashBackgroundColor: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"view_token">;
            token: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"launch_frame">;
            name: z.ZodString;
            url: z.ZodOptional<z.ZodString>;
            splashImageUrl: z.ZodOptional<z.ZodString>;
            splashBackgroundColor: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>], "type">;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const safeParseMiniAppEmbed: (rawResponse: unknown) => z.ZodSafeParseResult<{
    version: "1" | "next";
    imageUrl: string;
    button: {
        title: string;
        action: {
            type: "launch_miniapp";
            name: string;
            url?: string | undefined;
            splashImageUrl?: string | undefined;
            splashBackgroundColor?: string | undefined;
        } | {
            type: "view_token";
            token: string;
        } | {
            type: "launch_frame";
            name: string;
            url?: string | undefined;
            splashImageUrl?: string | undefined;
            splashBackgroundColor?: string | undefined;
        };
    };
    aspectRatio?: "1:1" | "3:2" | undefined;
}>;
export declare const safeParseFrameEmbed: (rawResponse: unknown) => z.ZodSafeParseResult<{
    version: "1" | "next";
    imageUrl: string;
    button: {
        title: string;
        action: {
            type: "launch_miniapp";
            name: string;
            url?: string | undefined;
            splashImageUrl?: string | undefined;
            splashBackgroundColor?: string | undefined;
        } | {
            type: "view_token";
            token: string;
        } | {
            type: "launch_frame";
            name: string;
            url?: string | undefined;
            splashImageUrl?: string | undefined;
            splashBackgroundColor?: string | undefined;
        };
    };
    aspectRatio?: "1:1" | "3:2" | undefined;
}>;
export type MiniAppEmbedNext = z.infer<typeof miniAppEmbedNextSchema>;
export type FrameEmbedNext = MiniAppEmbedNext;
