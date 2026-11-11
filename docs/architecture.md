# Architecture

The original CMU shell remains the source of application state, settings availability, equipment conditions and native callbacks. Visual adapters must consume live controls rather than replace model-dependent menus with fixed lists.

The manager panel loads a private connection descriptor, then uses authenticated JSONP requests to a loopback HTTP service. A native job coordinator records accepted actions and serializes execution of the file-copy engine. A random job key distinguishes an accepted action from a transport retry; losing an HTTP acknowledgement must never automatically repeat an installation.

The temporary workspace lives below `/tmp/cmu-manager.<session>`. The manager modifies only its marked `lab/rootfs` copy. Its initial checkpoint is four test inputs, not a full CMU image. Reboot removes RAM state; exported USB reports survive.

The visual overlay has a separate 600-second lifetime. The manager's 900-second action window refuses new work at expiry and drains already accepted work. Changing manager versions requires finishing jobs and rebooting; automatic cross-version RAM-state migration is not implemented.

Read-only preflight observes 87 expected paths in the latest collector: 82 module targets, three extra originals and two boot inputs. A matching report is an input to further storage research, not permission to install into live `/jci`.
