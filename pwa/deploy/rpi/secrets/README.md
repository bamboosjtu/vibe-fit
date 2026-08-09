# Runtime secrets

Create these files on the Raspberry Pi; never commit their values:

- `postgres_password`
- `database_url`
- `jwt_secret`
- `smtp_password`
- `tls_cert.pem`
- `tls_key.pem`
- `root_ca.pem`
- `restic_password` (required for encrypted upgrade snapshots and scheduled backups)

Use mode `0600` for passwords and private keys. `tls_cert.pem` and `root_ca.pem`
are public certificates and may use mode `0644`. `restic_password` is also
required for the encrypted snapshot that precedes every upgrade, even when the
scheduled backup timer is disabled.

Run production Compose commands through `../scripts/compose.sh`. The wrapper
loads these host files only for the Compose process and mounts them as read-only
service secrets with the target container UID; the values are not container
environment variables.

The private key of the root CA must not be copied to this directory.
