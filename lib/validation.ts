import { z } from 'zod';

export const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).optional(),
});

export const coordsSchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});

export const whatIfSchema = z.object({
  district_id: z.coerce.number(),
  rainfall_mm: z.coerce.number().nonnegative(),
});