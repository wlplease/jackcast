import { z } from 'zod';
export declare const eventMiniAppAddedSchema: z.ZodObject<{
    event: z.ZodLiteral<"miniapp_added">;
    notificationDetails: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        token: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type EventMiniAppAdded = z.infer<typeof eventMiniAppAddedSchema>;
export declare const eventMiniAppRemovedSchema: z.ZodObject<{
    event: z.ZodLiteral<"miniapp_removed">;
}, z.core.$strip>;
export type EventMiniAppRemoved = z.infer<typeof eventMiniAppRemovedSchema>;
export declare const eventNotificationsEnabledSchema: z.ZodObject<{
    event: z.ZodLiteral<"notifications_enabled">;
    notificationDetails: z.ZodObject<{
        url: z.ZodNonOptional<z.ZodString>;
        token: z.ZodNonOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type EventNotificationsEnabled = z.infer<typeof eventNotificationsEnabledSchema>;
export declare const notificationsDisabledSchema: z.ZodObject<{
    event: z.ZodLiteral<"notifications_disabled">;
}, z.core.$strip>;
export type EventNotificationsDisabled = z.infer<typeof notificationsDisabledSchema>;
export declare const serverEventSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    event: z.ZodLiteral<"miniapp_added">;
    notificationDetails: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        token: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    event: z.ZodLiteral<"miniapp_removed">;
}, z.core.$strip>, z.ZodObject<{
    event: z.ZodLiteral<"notifications_enabled">;
    notificationDetails: z.ZodObject<{
        url: z.ZodNonOptional<z.ZodString>;
        token: z.ZodNonOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    event: z.ZodLiteral<"notifications_disabled">;
}, z.core.$strip>], "event">;
export type MiniAppServerEvent = z.infer<typeof serverEventSchema>;
