# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

The integration holds no secret: it reads public, keyless services (`files.data.gouv.fr`,
`geo.api.gouv.fr`) over HTTPS. It stores in `/data` only the DVF release last seen, a compact
copy of the residential sales of the followed communes (date, type, surface, rooms, price,
coordinates, number and street as published by Etalab; no name, postcode nor parcel) and, per zone, the date of its latest sale. The location of your
houses is read from Gladys at run time and is neither stored nor logged.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the third-party services the integration talks to.
