# Admin Auth Bootstrap Runbook

## Objetivo

Crear el primer usuario administrativo de forma segura para el panel de observabilidad.

## Prerrequisitos

1. Base de datos bot migrada con modelos `bot_admin_*`.
2. Variables de entorno de bootstrap cargadas.
3. `ADMIN_AUTH_DUMMY_PASSWORD_HASH` definido.

## 1) Generar hash dummy anti-enumeracion

```bash
pnpm admin:auth:dummy-hash
```

Copiar el valor generado y asignarlo a:

```bash
ADMIN_AUTH_DUMMY_PASSWORD_HASH=<valor_generado>
```

En produccion el hash debe ser `argon2id$v1...`.

## 2) Definir variables de bootstrap inicial

Variables requeridas:

1. `ADMIN_BOOTSTRAP_EMAIL`
2. `ADMIN_BOOTSTRAP_USERNAME` (recomendado: `admin`)
3. `ADMIN_BOOTSTRAP_DISPLAY_NAME`
4. `ADMIN_BOOTSTRAP_ROLE=ADMIN`
5. `ADMIN_BOOTSTRAP_PASSWORD` (secreto fuerte)
6. `ADMIN_BOOTSTRAP_ALLOW_UPDATE=false` para primera creacion

## 3) Crear usuario inicial

```bash
pnpm admin:seed:initial
```

Comportamiento:

1. Crea el usuario si no existe.
2. Si ya existe, no actualiza por defecto.
3. Para actualizar de forma controlada: `ADMIN_BOOTSTRAP_ALLOW_UPDATE=true`.

## 4) Rotacion obligatoria de credencial

Antes de pasar a produccion:

1. Rotar `ADMIN_BOOTSTRAP_PASSWORD`.
2. Eliminar la variable del entorno runtime si no se usara nuevamente.
3. Mantener la creacion de nuevos administradores solo por procesos controlados.

## 5) Checklist de cierre

1. Login administrativo verificado.
2. Cookie `__Host-sism_admin_session` emitida con flags seguros.
3. `ADMIN_AUTH_DUMMY_PASSWORD_HASH` persistido en secret manager.
