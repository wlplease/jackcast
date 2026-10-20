# Build a Farcaster client with your own Snapchain node

This guide is for developers who want to run a node and a small client they control. It follows the three steps in [Balaji's client challenge](https://farcaster.xyz/balajis.eth/0x50184b62): provision compute, run Snapchain, and build a client that reads and writes through the node.

> **Status:** This is a starter lab, not a verified one-command installer. The official Snapchain deployment files and requirements can change. Complete the clean-machine run before treating the commands below as production instructions.

## Before you start

- A Linux VM with at least 4 vCPU, 16 GB RAM, and 2 TB of free disk, as listed in the [Snapchain node guide](https://snapchain.farcaster.xyz/guides/running-a-node). A snapshot can take hours to download and unpack; allow extra disk headroom and monitor free space.
- SSH access and Docker Engine with the Compose plugin on the VM.
- For reading and posting as an **existing account**, access to that account's custody wallet when authorizing a new app key. Prefer a separate test account while learning. Never paste a recovery phrase into a command, shell history, GitHub, or this tutorial.
- For a **new account**, a custody wallet and OP Mainnet funds for account registration and storage rent. Creating a new account is separate from adding a gasless signer to an existing account.
- Node.js 20 or newer and npm on the development computer.

**Costs:** the VM and disk are billed by your cloud provider. Account registration and storage rent are on OP Mainnet and have separate protocol costs. Gasless signer registration itself does not require an OP Mainnet transaction. Check current provider and protocol costs before proceeding.

## 0. Provision compute

Choose a Linux VM in a region you can reach. For Google Cloud, set a project and region, then create a VM with the resources above. This example uses Ubuntu 24.04 and a persistent 2 TB disk; confirm the current machine and disk prices in the Cloud Console first.

```sh
gcloud config set project YOUR_PROJECT_ID
gcloud compute instances create snapchain-node \
  --zone=us-central1-a \
  --machine-type=n2-standard-4 \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=100GB \
  --create-disk=name=snapchain-data,size=2048GB,type=pd-ssd,auto-delete=no
```

This provisions a machine; it does not open the Snapchain API to the internet. Keep node ports private or restrict them to known client IPs. Do not expose administrative or unauthenticated RPC endpoints publicly.

## 1. Run Snapchain

Use the official [Run Snapchain guide](https://snapchain.farcaster.xyz/guides/running-a-node) as the source of truth for the current release, configuration, Compose files, and ports. Snapchain's deployment artifacts are maintained upstream; this repository does not vendor or pin a node release.

SSH to the VM and install Docker using the official [Docker Engine for Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/). Then follow the Snapchain guide to install its Compose configuration and point its data directory at the persistent disk. Start the stack using the Compose command from that checked-out release.

Check that the containers are healthy and follow the node logs until snapshot import completes. For example, if the official Compose project exposes a service named `snapchain`, run this from its directory:

```sh
sudo docker compose ps
sudo docker compose logs --tail 50 -f snapchain
df -h
```

Snapshot download and unpacking are expected to take time. Do not run the client step until the node reports healthy and its API responds. A **FID** is the numeric Farcaster account ID. A **cast** is a signed protocol message. Snapchain stores and serves these messages; a **read node** follows the network, while a **validator** participates in accepting and propagating messages. Current Snapchain docs say read nodes can also accept submissions and forward messages to validators; use the current [node type and submission docs](https://snapchain.farcaster.xyz/node-types#message-submission-and-the-mempool) for the exact behavior of your version.

## 2. Build a client against your node

The node exposes the Snapchain APIs documented in its [HTTP](https://snapchain.farcaster.xyz/httpapi/httpapi) and [gRPC](https://snapchain.farcaster.xyz/grpcapi/grpcapi) references. Keep the node URL in a server-side environment variable; do not publish an unrestricted node endpoint or place credentials in browser code.

```sh
mkdir snapchain-client
cd snapchain-client
npm init -y
npm install @farcaster/hub-nodejs viem
```

Create `.env` locally (and add it to `.gitignore`) with your node's HTTP/gRPC address and OP Mainnet RPC URL. Use the current official [writing messages guide](https://snapchain.farcaster.xyz/guides/writing-messages) for SDK versions and message construction; it documents protocol details that must match your installed package and node release.

Your client flow is:

1. **Read:** query the node for casts, profiles, and account state. A FID identifies the account; the custody address is the wallet that controls identity-level authorization.
2. **Authorize an app key:** for an existing account, generate an Ed25519 keypair for the client, then have the custody wallet sign the current gasless `KEY_ADD` authorization. Restrict the key to only the message types the client needs and use a short TTL. The custody key authorizes the app key; the app key signs routine casts, follows, and reactions. Never store the custody private key in a web app or ask users for their recovery phrase.
3. **Write:** construct and sign a protocol message with the app key, submit it to your node, and handle the node's acceptance/rejection response. The node may forward it to validators. Do not assume that an HTTP 200 alone means the message propagated; verify it by reading the message back and surface useful errors.
4. **Revoke:** provide a way to remove a compromised app key. Gasless keys also have scopes and a sliding expiration; explain those limits in the client UI.

Creating a new FID, funding custody, and renting storage are distinct from adding an app key. Current protocol documentation describes gasless app keys, so do not require an Optimism transaction just to authorize a scoped app key. Consult the live [writing guide](https://snapchain.farcaster.xyz/guides/writing-messages) for the current registration, rent, nonce, scope, TTL, and SDK procedures.

### Concepts to keep straight

- **Custody address:** the wallet that controls an account's identity authorization. Protect it like a root credential.
- **App key / signer:** a delegated Ed25519 key used by a client to sign allowed messages. It should have the smallest necessary scopes and a limited lifetime.
- **Snapchain message:** a signed protocol action such as a cast, follow, or reaction.
- **Read node and validator:** a read node stores and serves replicated state. Depending on the running version, it can accept a message and forward it toward validators; validators are responsible for validating and propagating messages. They are not interchangeable roles.
- **Storage rent:** protocol storage allocation associated with an account, paid separately from gasless app-key authorization. Existing accounts may already have storage; inspect their state before paying or registering anything.

## Security checklist

- Learn with a test account. Do not paste a main account recovery phrase into this tutorial, a terminal, or a third-party app.
- Use a delegated app key, limited message scopes, and a short TTL. Keep custody authorization separate from routine message signing.
- Bind node RPC to a private network or firewall allowlist. If access must cross an untrusted network, use authenticated TLS and rate limits.
- Keep OP RPC URLs, cloud credentials, and node credentials out of source control. Rotate anything that was accidentally committed.
- Verify the message by reading it back and confirm account ownership before presenting posting success.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Node is not responding | Check Compose health and logs, firewall rules, disk space, and whether snapshot import is still running. |
| Snapshot is slow | Check provider disk throughput, available space, and the official release's snapshot instructions. Do not repeatedly restart an active import. |
| `KEY_ADD` rejected | Re-read the signers and current nonce; check custody/FID correspondence, deadline, signature domain, scope values, and whether your node version supports gasless keys. |
| Message rejected | Check the signer is active, its scopes allow the message type, the message is well formed, and the node is connected to the intended network. |
| Message accepted but not visible elsewhere | Read it back from the node, inspect submission/mempool logs, and check validator connectivity and propagation. |

## References

- [Snapchain: Run a node](https://snapchain.farcaster.xyz/guides/running-a-node)
- [Snapchain: Validators vs. read nodes](https://snapchain.farcaster.xyz/node-types#message-submission-and-the-mempool)
- [Snapchain: Writing messages and gasless signers](https://snapchain.farcaster.xyz/guides/writing-messages)
- [Farcaster architecture](https://docs.farcaster.xyz/learn/architecture/overview)
- [Farcaster protocol: Hello World](https://docs.farcaster.xyz/developers/guides/basics/hello-world)

## What still needs validation

Before advertising this as a tested quickstart, pin an official Snapchain release and check in a small, license-compatible provisioning script and client example. Then have another developer follow the guide on a clean account and clean VM, record total setup time and actual cloud/rent costs, and publish the run result. The challenge asks for an independent public vouch; do not imply one exists until a human has completed the tutorial and posted it.
