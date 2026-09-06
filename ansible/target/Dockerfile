# The Ansible TARGET: a plain, mostly-unconfigured Ubuntu host. The only things baked
# in are what a real fresh VM would need before Ansible could ever reach it at all —
# sshd, a Python interpreter (Ansible's modules require one on the managed node), and
# the public half of the demo keypair for the initial bootstrap connection.
#
# Everything else (Docker, curl, git, the roomsync_deploy user, the deployed app
# itself) is installed by the PLAYBOOK, not this Dockerfile — that's the actual point
# of the exercise: proving Ansible provisions the box, not that the image arrives
# pre-provisioned.
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
        openssh-server \
        python3 \
        sudo \
    && mkdir -p /var/run/sshd \
    && rm -rf /var/lib/apt/lists/*

# Key-only auth: no password login, ever.
RUN sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config \
    && sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config

# Ansible connects as root to bootstrap the box (create the real deploy user, install
# packages) — this is the initial-access key, not the deploy user's key. The deploy
# user itself (roomsync_deploy) is created later, by the playbook, with no baked-in
# credentials of its own.
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh
COPY keys/id_rsa.pub /root/.ssh/authorized_keys
RUN chmod 600 /root/.ssh/authorized_keys

EXPOSE 22
CMD ["/usr/sbin/sshd", "-D"]
