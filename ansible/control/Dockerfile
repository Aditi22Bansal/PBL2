# The Ansible CONTROL node: just the tooling needed to reach the target and run the
# playbook — Python, Ansible itself, and an SSH client. Carries no application code;
# it only ever talks to the target over SSH.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        openssh-client \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir ansible

WORKDIR /ansible
COPY control/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# inventory.ini, playbook.yml and templates/ are bind-mounted at runtime (see
# ansible/docker-compose.yml) rather than baked in here, so editing the playbook
# doesn't require an image rebuild.
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sleep", "infinity"]
