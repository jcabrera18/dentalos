# Desarrollo — Testing y validación

## Estado actual (verificado)
- **No hay tests automatizados escritos.** El backend tiene `vitest` configurado (`npm test` → `vitest run`) pero **sin archivos `*.test.ts`/`*.spec.ts`**. El frontend no tiene framework de test.
- No lo documentes como cubierto por tests. Si tu cambio es sensible (pagos, RLS, booking, cuota), validá a mano y consideralo área de riesgo.

## Cómo validar un cambio hoy
1. **Lint**: `npm run lint` en `web/` y en `../dentalos-api/`.
2. **Type-check / build**: `npm run build` (web → `next build`; API → `tsc`). El build de la API falla ante errores de tipos aunque `strict: false`.
3. **Prueba manual**:
   - Levantá API (`npm run dev`) + worker (`npm run dev:worker`) + web (`npm run dev`).
   - Usá Swagger (`/docs`) para probar endpoints sueltos.
   - Para flujos con sesión, logueate en la web y ejercé el flujo end-to-end.
4. **Multi-tenant**: ante cambios que tocan queries de tenant, verificá con dos clínicas distintas que no haya fuga de datos (es la clase de bug más grave acá).

## Si agregás tests (recomendado para áreas críticas)
- Backend: Vitest ya está. Priorizá `book_appointment` (concurrencia), reglas de planes/downgrade, cuota WhatsApp, idempotencia de webhooks y policies RLS.
- Apuntá a tests de integración sobre los handlers más que unitarios de "god routes" (ver deuda D1).
