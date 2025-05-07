pipeline {
    agent any

    environment {
        NODE_VERSION = '18.x'
        FLYCTL_VERSION = '0.1.76'
        TEST_DB_URL = credentials('test-db-url')
        JWT_SECRET = credentials('jwt-secret')
        TEST_USER = credentials('test-user')
        TEST_PASSWORD = credentials('test-password')
    }

    stages {
        stage('Setup') {
            steps {
                // Install Node.js
                sh 'curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION} | bash -'
                sh 'apt-get install -y nodejs'
                
                // Install Fly.io CLI
                sh 'curl -L https://fly.io/install.sh | sh'
                
                // Install dependencies
                sh 'npm run install:all'
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }

        stage('Unit Tests') {
            steps {
                sh '''
                    export NODE_ENV=test
                    export DATABASE_URL=$TEST_DB_URL
                    export JWT_SECRET=$JWT_SECRET
                    npm run test:unit
                '''
            }
        }

        stage('Integration Tests') {
            steps {
                sh '''
                    export NODE_ENV=test
                    export DATABASE_URL=$TEST_DB_URL
                    export JWT_SECRET=$JWT_SECRET
                    export TEST_USER=$TEST_USER
                    export TEST_PASSWORD=$TEST_PASSWORD
                    npm run test:integration
                '''
            }
        }

        stage('E2E Tests') {
            steps {
                sh '''
                    export NODE_ENV=test
                    export DATABASE_URL=$TEST_DB_URL
                    export JWT_SECRET=$JWT_SECRET
                    export TEST_USER=$TEST_USER
                    export TEST_PASSWORD=$TEST_PASSWORD
                    npm run test:e2e
                '''
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                sh '''
                    cd backend
                    flyctl deploy --remote-only
                '''
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                input message: 'Deploy to production?'
                sh '''
                    cd backend
                    flyctl deploy --remote-only --app fiserv-inventory-api-prod
                '''
            }
        }
    }

    post {
        always {
            // Publish test results
            junit '**/test-results.xml'
            
            // Publish coverage report
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'coverage',
                reportFiles: 'index.html',
                reportName: 'Coverage Report'
            ])
            
            // Clean workspace
            cleanWs()
        }
        
        success {
            slackSend(
                color: 'good',
                message: "Build #${env.BUILD_NUMBER} succeeded on ${env.BRANCH_NAME}"
            )
        }
        
        failure {
            slackSend(
                color: 'danger',
                message: "Build #${env.BUILD_NUMBER} failed on ${env.BRANCH_NAME}"
            )
        }
    }
} 