# CMU testing over an existing SSH connection

SSH over Wi-Fi is a transport for native tests and report collection. It can replace the repeated USB-keyboard terminal bootstrap once the owner has confirmed working access. The laptop tools prepare and inspect a connection and can explicitly start the prepared USB manager after authentication. A separate device-side helper can inspect or start the existing stock SSH daemon. They do not install keys or run an unattended installation suite.

Test vehicle: Mazda Roadster ND, model year 2016, Japanese market. Other Connect 1 vehicles are untested. Firmware under investigation: 74.00.324A EU. **No live SSH connection to this CMU has yet been verified.** Availability of SSH on this installed firmware is an observation to collect, not an assumption based on a generic firmware guide.

## Documented default credentials

MZD-AIO documents **username `cmu`, password `jci`** after its SSH_Bringback or autorun/recovery procedure. Firmware before 56.00.513 used username `root`; some AIO installations additionally have `jci` / `jci`. These are public historical defaults, not credentials verified for this particular 74.00.324A installation. Source: [MZD-AIO FAQ](https://github.com/Trevelopment/mazdatweaks/blob/master/AIO-FAQ.md?plain=1), [maintainer SSH notes](https://github.com/Trevelopment/mazdatweaks/blob/master/ProTipsDraft.md).

**Replace the standard password after your first successful login**, using `passwd` interactively on the device with its supported account tools. Do not put the replacement password in scripts, issues or documentation. This project does not silently change the password or assume that a stock password works when password authentication is disabled. Verify the replacement in a second session before closing the working session; persistence across reboots and firmware updates requires a separate device-specific check.

## Inspect or start the stock SSH server

`src/ssh/start-ssh.sh` is a device-side helper, not the laptop transport. Copy it to a flash drive, keeping its lowercase name, and invoke it from the already working CMU root terminal (substitute the actual USB partition):

```sh
sh /tmp/mnt/sda1/start-ssh.sh check
sh /tmp/mnt/sda1/start-ssh.sh start
```

It reports configured ports, selected public authentication policy and UID-0 login names. When starting, it validates the existing configuration and host keys with stock sshd, avoids starting over an occupied configured port and checks for a resulting listener. A listener alone does not prove that it is sshd, that Wi-Fi can reach it, or that login works. It leaves passwords, keys, configuration, firewall and boot scripts unchanged. It has no project fifteen-minute timer; stock process lifetime applies and reboot follows stock startup policy.

The inspected local firmware copy specifies **port 36000**, `PasswordAuthentication no` and a native network startup script that invokes `/usr/sbin/sshd`. This suggests SSH may already start natively; it does not establish the current device state. The earlier attempt on port 22 did not test the configured 36000 endpoint. Read the live helper output before choosing the port. If password authentication remains disabled, the public default password cannot authenticate; an already configured key or a separately reviewed access setup is required. Starting a daemon does not reset an account password or bypass its policy.

Service helper 0.1.1 also accepts nonexecutable copied daemon files for inspection; live execution still requires the installed binary to be executable.

For offline inspection only, a second argument can point to a firmware copy. The helper refuses to start any executable from a copy. No firmware copy or real device credentials are included in the public package.

## Connection prerequisites

The laptop and CMU must be on a network that permits them to reach one another, for example the same private Wi-Fi/hotspot. Client isolation on some hotspots can prevent this. Obtain the CMU address from its network information or the hotspot/router's connected-device list. Use the owner's known SSH login and authentication method; do not post passwords or private keys in issues or chat.

An OpenSSH client and Python 3 are required on the laptop. No additional software is installed on CMU. An existing SSH listener might be unavailable over Wi-Fi, or might not permit forwarding; these are separate checks. Do not expose the CMU SSH port to the public Internet.

## Prepare locally, then perform one manual login

From the repository root, substitute the actual address and known login. `192.0.2.10` and `cmu` below are documentation examples, not discovered device settings or a claim about the correct account.

```sh
python3 tools/cmu-ssh.py prepare --host 192.0.2.10 --user cmu --port 36000
python3 tools/cmu-ssh.py connect
```

Preparation only writes private local connection files under ignored `build/ssh/roadster`. The first login runs in the owner's terminal: verify the CMU host-key fingerprint using a trusted device-side or previously verified record before accepting it, then enter the password there if needed. Never accept an unexpected changed host key automatically. If no trusted fingerprint is available, stop and establish it before trusting the connection.

The OpenSSH master connection can remain idle for ten minutes after a client exits. This retains the authenticated connection, not a saved password. Public-key authentication already configured by the owner also works. The tool does not edit `authorized_keys`, Dropbear configuration or firmware. Automatic actions require a previously trusted host key and noninteractive authentication (an existing master connection, ssh-agent or an already configured key).

Old-server negotiation failures must be diagnosed from the actual error. The tool does not globally enable legacy algorithms or turn off host-key verification.

## Read-only observations

```sh
python3 tools/cmu-ssh.py probe
python3 tools/cmu-ssh.py diagnose
python3 tools/cmu-ssh.py check --partition sda1
```

- `probe` reads the login UID, kernel/architecture, version-file SHA-256 when the stock command exists, temporary mount observation and the presence of known USB package directories. It neither guesses the vehicle model nor claims compatibility from these fields.
- `diagnose` streams our bounded startup collector over SSH; it works without uploading that script to the USB. It does not print the manager's auth or client descriptor files.
- `check` invokes the already prepared USB package's own `check.sh`. Use the actual USB partition. This is an explicit execution of the owner's existing package, not a generic arbitrary-command runner. The root/private-workspace checks of that package still apply.

`check` needs a prepared manager package and an already running session. `probe` does not. An SSH connection with a non-root UID does not establish permission to run root-only tests. A SHA-256 command being unavailable is reported as unavailable, not as a firmware mismatch.

## Start the prepared manager after connecting

```sh
python3 tools/cmu-ssh.py start-manager --partition sda1
python3 tools/cmu-ssh.py check --partition sda1
```

`start-manager` explicitly invokes the existing package's `start.sh` through the trusted, authenticated connection and requires UID 0. It does not upload a package, enable SSH or change live firmware. Use the complete current manager USB package; its root and private-workspace checks still apply. Startup and UI connection remain separate native observations.

## Reach the loopback manager through a tunnel

```sh
python3 tools/cmu-ssh.py tunnel
```

Keep this terminal running. The laptop's `127.0.0.1:19970` forwards to CMU `127.0.0.1:9970`; Ctrl-C closes the tunnel client. The manager remains bound to its own loopback interface. The service must already be running, and the SSH server must allow forwarding. A tunnel opening does not prove that its remote destination is listening or authenticated.

This is a channel for a native test controller, not an installed browser dashboard. It does not automatically retrieve the connection token or turn the JSONP API into a web page. The existing manager token and request-key rules still apply. The SSH connection's ten-minute idle lifetime and the manager's fifteen-minute action window are independent.

To explicitly close the shared SSH master connection:

```sh
python3 tools/cmu-ssh.py disconnect
```

## Native automation sequence

1. Verify the SSH host identity, account, firmware observation and RAM/USB layout.
2. Confirm the selected manager candidate startup over SSH using the same prepared package and existing script. Confirm authenticated service health and UI connection on CMU.
3. Adapt the existing copy-only backend workflow to the verified native session: checkpoint, install on the marked RAM copy, duplicate-request handling, rollback, recovery and report collection.
4. Keep report files local and verify them before publishing sanitized summaries.
5. Separately verify controller input, native menus, camera, CarPlay/Android Auto and graphics on the vehicle. SSH process checks do not prove those behaviors.

The first two observations are pending vehicle availability. These connection helpers are not a claim that a native unattended suite, permanent installer or full firmware recovery has been completed.

## Offline validation

`tests/test_ssh_transport.py` checks private connection files, input validation, host-key and authentication options, loopback-only forwarding, preservation of existing known-host records and real OpenSSH configuration parsing with `ssh -G`. It never connects to the example address. These checks do not establish that the CMU's Dropbear/OpenSSH implementation accepts the connection.

References: [OpenSSH client options](https://man.openbsd.org/ssh), [connection sharing and host-key configuration](https://man.openbsd.org/ssh_config).
