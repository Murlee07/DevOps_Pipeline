# Jenkins controller with the full DevSecOps toolchain baked in.
FROM jenkins/jenkins:lts-jdk21

USER root

ARG SONAR_SCANNER_VERSION=6.2.1.4610
ARG NODE_MAJOR=22

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg lsb-release unzip jq git wget apt-transport-https \
 && install -m 0755 -d /etc/apt/keyrings \
 # --- Docker CLI + compose plugin (talks to Docker Desktop through the mounted socket) ---
 && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
      > /etc/apt/sources.list.d/docker.list \
 # --- Trivy (official Aqua Security apt repo) ---
 && curl -fsSL https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor -o /etc/apt/keyrings/trivy.gpg \
 && echo "deb [signed-by=/etc/apt/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb generic main" \
      > /etc/apt/sources.list.d/trivy.list \
 # --- Terraform (HashiCorp apt repo) ---
 && curl -fsSL https://apt.releases.hashicorp.com/gpg | gpg --dearmor -o /etc/apt/keyrings/hashicorp.gpg \
 && echo "deb [signed-by=/etc/apt/keyrings/hashicorp.gpg] https://apt.releases.hashicorp.com $(. /etc/os-release && echo $VERSION_CODENAME) main" \
      > /etc/apt/sources.list.d/hashicorp.list \
 # --- Node.js for running tests/builds on the controller ---
 && curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
 && apt-get update \
 && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin trivy terraform nodejs \
 && rm -rf /var/lib/apt/lists/*

# --- kubectl, AWS CLI v2, sonar-scanner (multi-arch: amd64 / arm64) ---
RUN set -eux; \
    ARCH="$(dpkg --print-architecture)"; \
    case "$ARCH" in \
      amd64) AWS_ARCH=x86_64; SONAR_ARCH=x64 ;; \
      arm64) AWS_ARCH=aarch64; SONAR_ARCH=aarch64 ;; \
      *) echo "unsupported arch $ARCH"; exit 1 ;; \
    esac; \
    KVER="$(curl -fsSL https://dl.k8s.io/release/stable.txt)"; \
    curl -fsSLo /usr/local/bin/kubectl "https://dl.k8s.io/release/${KVER}/bin/linux/${ARCH}/kubectl"; \
    chmod +x /usr/local/bin/kubectl; \
    curl -fsSLo /tmp/awscli.zip "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_ARCH}.zip"; \
    unzip -q /tmp/awscli.zip -d /tmp && /tmp/aws/install && rm -rf /tmp/aws /tmp/awscli.zip; \
    curl -fsSLo /tmp/sonar.zip "https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SONAR_SCANNER_VERSION}-linux-${SONAR_ARCH}.zip"; \
    unzip -q /tmp/sonar.zip -d /opt && mv /opt/sonar-scanner-* /opt/sonar-scanner && rm /tmp/sonar.zip; \
    ln -s /opt/sonar-scanner/bin/sonar-scanner /usr/local/bin/sonar-scanner

# --- Jenkins plugins + Configuration-as-Code ---
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
COPY casc.yaml /usr/share/jenkins/casc.yaml

USER jenkins
