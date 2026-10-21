import { z } from 'zod';
export declare const notificationDetailsSchema: z.ZodObject<{
    url: z.ZodString;
    token: z.ZodString;
}, z.core.$strip>;
export type MiniAppNotificationDetails = z.infer<typeof notificationDetailsSchema>;
export declare const sendNotificationRequestSchema: z.ZodObject<{
    notificationId: z.ZodString;
    title: z.ZodString;
    body: z.ZodString;
    targetUrl: z.ZodString;
    tokens: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type SendNotificationRequest = z.infer<typeof sendNotificationRequestSchema>;
export declare const sendNotificationResponseSchema: z.ZodObject<{
    result: z.ZodObject<{
        successfulTokens: z.ZodArray<z.ZodString>;
        invalidTokens: z.ZodArray<z.ZodString>;
        rateLimitedTokens: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type SendNotificationResponse = z.infer<typeof sendNotificationResponseSchema>;
