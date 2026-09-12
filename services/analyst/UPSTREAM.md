# Source provenance

12 September 2026.

This service imports the completed Meritus analyst desk from the local repository
`/Users/williamrogers/Documents/ChatGPT/Meritus`, commit
`5983460981062545092b78510330f7bccf32df1f`. Its source history remains in that repository.

The import contains application code, fixtures, tests and operator instructions.
Runtime databases, the operator account, evidence files, environment configuration,
licence registration, private local planning/verification records and the signed licence
document are excluded. The two government
PDF files in `tests/fixtures` are test fixtures.

Subsequent changes in this repository add the Directors Workspace bridge and embedded
interface. The local deployment and its existing account remain independent. The
production portal uses its existing Clerk authority and a dedicated server-to-server
secret, with each operation attributed to the current director.
