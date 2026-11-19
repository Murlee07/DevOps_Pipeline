// =============================================================================
//  ShieldBoard — Secure DevSecOps CI/CD pipeline
//  Checkout -> Test/Lint -> SonarQube -> Quality Gate -> Trivy FS -> Docker build
//  -> Trivy image -> Push (Docker Hub / ECR) -> Deploy (Compose / Docker Desktop K8s / EKS)
// =============================================================================

def deployToKubernetes(String overlay, String registry) {
    withCredentials([
        string(credentialsId: 'app-jwt-secret', variable: 'JWT_SECRET'),
        string(credentialsId: 'app-db-password', variable: 'DB_PASSWORD')
    ]) {
        withEnv(["OVERLAY=${overlay}", "TARGET_REGISTRY=${registry}"]) {
            sh '''
                set -eu
                kubectl version --client=true
                kubectl create namespace "$K8S_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

                # Secrets come from Jenkins credentials — never committed to git
                kubectl -n "$K8S_NAMESPACE" create secret generic shieldboard-secrets \
                  --from-literal=POSTGRES_PASSWORD="$DB_PASSWORD" \
                  --from-literal=JWT_SECRET="$JWT_SECRET" \
                  --from-literal=DATABASE_URL="postgres://shieldboard:${DB_PASSWORD}@postgres:5432/shieldboard" \
                  --dry-run=client -o yaml | kubectl apply -f -

                kubectl apply -k "k8s/overlays/$OVERLAY"

                kubectl -n "$K8S_NAMESPACE" set image deployment/backend  backend="$TARGET_REGISTRY/shieldboard-backend:$IMAGE_TAG"
                kubectl -n "$K8S_NAMESPACE" set image deployment/frontend frontend="$TARGET_REGISTRY/shieldboard-frontend:$IMAGE_TAG"
                kubectl -n "$K8S_NAMESPACE" set env deployment/backend BUILD_NUMBER="$BUILD_NUMBER" GIT_COMMIT="$GIT_SHORT"

                kubectl -n "$K8S_NAMESPACE" rollout status statefulset/postgres --timeout=180s
                kubectl -n "$K8S_NAMESPACE" rollout status deployment/backend   --timeout=240s
                kubectl -n "$K8S_NAMESPACE" rollout status deployment/frontend  --timeout=180s
                kubectl -n "$K8S_NAMESPACE" get pods,svc -o wide
            '''
        }
    }
}

pipeline {
    agent any

    options {
        timestamps()
        ansiColor('xterm')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 60, unit: 'MINUTES')
    }

    parameters {
        choice(name: 'DEPLOY_TARGET', choices: ['compose', 'docker-desktop-k8s', 'aws-eks', 'none'],
               description: 'Where to deploy after all security gates pass')
        booleanParam(name: 'PUSH_IMAGES', defaultValue: false,
                     description: 'Push images to Docker Hub (images are always pushed to ECR for aws-eks)')
        booleanParam(name: 'ENFORCE_QUALITY_GATE', defaultValue: true,
                     description: 'Fail the build if the SonarQube quality gate fails')
        choice(name: 'TRIVY_FAIL_SEVERITY', choices: ['CRITICAL', 'HIGH,CRITICAL', 'NONE'],
               description: 'Severities that fail the Trivy gates')
    }

    environment {
        APP_NAME      = 'shieldboard'
        K8S_NAMESPACE = 'shieldboard'
        AWS_REGION    = 'ap-south-1'
        EKS_CLUSTER   = 'shieldboard-eks'
        TRIVY_CACHE_DIR = '/root/.cache/trivy'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_SHORT}"
                    env.REGISTRY  = env.DOCKERHUB_USER ?: 'murlee7'
                    currentBuild.displayName = "#${env.BUILD_NUMBER} · ${env.GIT_SHORT} · ${params.DEPLOY_TARGET}"
                }
                sh 'mkdir -p reports && echo "Image tag: $IMAGE_TAG"'
            }
        }

        stage('Test & Lint') {
            parallel {
                stage('Backend') {
                    steps {
                        dir('backend') {
                            sh '''
                                if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
                                npm run lint
                                npm test
                            '''
                        }
                    }
                    post {
                        always {
                            junit allowEmptyResults: true, testResults: 'backend/reports/junit.xml'
                        }
                    }
                }
                stage('Frontend') {
                    steps {
                        dir('frontend') {
                            sh '''
                                if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
                                npm run lint
                                npm run build
                            '''
                        }
                    }
                }
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    // single quotes: the token is expanded by the shell, never interpolated by Groovy
                    sh 'sonar-scanner -Dsonar.host.url="$SONAR_HOST_URL" -Dsonar.token="$SONAR_AUTH_TOKEN" -Dsonar.projectVersion="$IMAGE_TAG"'
                }
            }
        }

        stage('Quality Gate') {
            when { expression { return params.ENFORCE_QUALITY_GATE } }
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Trivy FS Scan') {
            steps {
                sh '''
                    set -eu
                    # Full report: vulnerable deps, leaked secrets, Dockerfile/K8s/Terraform misconfigurations
                    trivy fs --cache-dir "$TRIVY_CACHE_DIR" --scanners vuln,secret,misconfig \
                      --severity HIGH,CRITICAL --skip-dirs "**/node_modules" --skip-dirs "**/dist" \
                      --format table --output reports/trivy-fs.txt .
                    trivy fs --cache-dir "$TRIVY_CACHE_DIR" --skip-db-update --scanners vuln,secret,misconfig \
                      --skip-dirs "**/node_modules" --skip-dirs "**/dist" \
                      --format json --output reports/trivy-fs.json .
                    cat reports/trivy-fs.txt

                    # Gate: fail on vulnerable dependencies / leaked secrets at the chosen severity
                    if [ "$TRIVY_FAIL_SEVERITY" != "NONE" ]; then
                      trivy fs --cache-dir "$TRIVY_CACHE_DIR" --skip-db-update --scanners vuln,secret \
                        --severity "$TRIVY_FAIL_SEVERITY" --ignore-unfixed --exit-code 1 \
                        --skip-dirs "**/node_modules" --skip-dirs "**/dist" .
                    fi
                '''
            }
        }

        stage('Build Images') {
            steps {
                sh '''
                    set -eu
                    docker build --pull \
                      --build-arg APP_VERSION="$IMAGE_TAG" --build-arg GIT_COMMIT="$GIT_SHORT" --build-arg BUILD_NUMBER="$BUILD_NUMBER" \
                      -t "$REGISTRY/shieldboard-backend:$IMAGE_TAG" -t "$REGISTRY/shieldboard-backend:latest" backend
                    docker build --pull \
                      --build-arg APP_VERSION="$IMAGE_TAG" --build-arg GIT_COMMIT="$GIT_SHORT" \
                      -t "$REGISTRY/shieldboard-frontend:$IMAGE_TAG" -t "$REGISTRY/shieldboard-frontend:latest" frontend
                    docker images | grep shieldboard
                '''
            }
        }

        stage('Trivy Image Scan') {
            steps {
                sh '''
                    set -eu
                    for svc in backend frontend; do
                      IMG="$REGISTRY/shieldboard-$svc:$IMAGE_TAG"
                      trivy image --cache-dir "$TRIVY_CACHE_DIR" --severity HIGH,CRITICAL \
                        --format table --output "reports/trivy-image-$svc.txt" "$IMG"
                      trivy image --cache-dir "$TRIVY_CACHE_DIR" --skip-db-update \
                        --format json --output "reports/trivy-image-$svc.json" "$IMG"
                      cat "reports/trivy-image-$svc.txt"
                      if [ "$TRIVY_FAIL_SEVERITY" != "NONE" ]; then
                        trivy image --cache-dir "$TRIVY_CACHE_DIR" --skip-db-update \
                          --severity "$TRIVY_FAIL_SEVERITY" --ignore-unfixed --exit-code 1 "$IMG"
                      fi
                    done
                '''
            }
        }

        stage('Push: Docker Hub') {
            when { expression { return params.PUSH_IMAGES && params.DEPLOY_TARGET != 'aws-eks' } }
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub-creds',
                                                  usernameVariable: 'DH_USER', passwordVariable: 'DH_TOKEN')]) {
                    sh '''
                        set -eu
                        echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin
                        for svc in backend frontend; do
                          docker push "$REGISTRY/shieldboard-$svc:$IMAGE_TAG"
                          docker push "$REGISTRY/shieldboard-$svc:latest"
                        done
                        docker logout
                    '''
                }
            }
        }

        stage('Push: Amazon ECR') {
            when { expression { return params.DEPLOY_TARGET == 'aws-eks' } }
            steps {
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-creds']]) {
                    script {
                        def account = sh(script: 'aws sts get-caller-identity --query Account --output text', returnStdout: true).trim()
                        env.ECR_REGISTRY = "${account}.dkr.ecr.${env.AWS_REGION}.amazonaws.com"
                    }
                    sh '''
                        set -eu
                        aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
                        for svc in backend frontend; do
                          docker tag "$REGISTRY/shieldboard-$svc:$IMAGE_TAG" "$ECR_REGISTRY/shieldboard-$svc:$IMAGE_TAG"
                          docker push "$ECR_REGISTRY/shieldboard-$svc:$IMAGE_TAG"
                        done
                    '''
                }
            }
        }

        stage('Deploy: Docker Compose') {
            when { expression { return params.DEPLOY_TARGET == 'compose' } }
            steps {
                withCredentials([
                    string(credentialsId: 'app-jwt-secret', variable: 'JWT_SECRET'),
                    string(credentialsId: 'app-db-password', variable: 'POSTGRES_PASSWORD')
                ]) {
                    sh '''
                        set -eu
                        export DOCKER_REGISTRY="$REGISTRY" DEPLOY_ENV=jenkins-compose GIT_COMMIT="$GIT_SHORT"
                        docker compose -f docker-compose.yml up -d --no-build --remove-orphans
                        docker compose -f docker-compose.yml ps
                        echo "App deployed -> http://localhost:3000"
                    '''
                }
            }
        }

        stage('Deploy: Docker Desktop Kubernetes') {
            when { expression { return params.DEPLOY_TARGET == 'docker-desktop-k8s' } }
            steps {
                withCredentials([file(credentialsId: 'kubeconfig-local', variable: 'KUBECONFIG')]) {
                    script { deployToKubernetes('local', env.REGISTRY) }
                }
                echo 'App deployed -> http://localhost:8081'
            }
        }

        stage('Deploy: AWS EKS') {
            when { expression { return params.DEPLOY_TARGET == 'aws-eks' } }
            steps {
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-creds']]) {
                    withEnv(["KUBECONFIG=${env.WORKSPACE}/.kube/eks-config"]) {
                        sh 'aws eks update-kubeconfig --name "$EKS_CLUSTER" --region "$AWS_REGION" --kubeconfig "$KUBECONFIG"'
                        script { deployToKubernetes('aws', env.ECR_REGISTRY) }
                        sh '''
                            echo "Load balancer address (may take 1-3 minutes to become reachable):"
                            kubectl -n "$K8S_NAMESPACE" get svc frontend -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' || true
                        '''
                    }
                }
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
            sh 'docker image prune -f >/dev/null 2>&1 || true'
        }
        success {
            echo "✅ ${env.APP_NAME} ${env.IMAGE_TAG} passed all quality and security gates."
        }
        failure {
            echo '❌ Pipeline failed — check the stage logs and archived reports (Trivy / SonarQube).'
        }
    }
}
