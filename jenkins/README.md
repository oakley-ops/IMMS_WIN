# Jenkins CI/CD Setup Guide

## Prerequisites
- Jenkins server (v2.375.2 or higher)
- Docker installed on Jenkins server
- Access to Fly.io and Netlify accounts

## Initial Setup

1. **Install Jenkins**
```bash
# On Ubuntu
wget -q -O - https://pkg.jenkins.io/debian-stable/jenkins.io.key | sudo apt-key add -
sudo sh -c 'echo deb https://pkg.jenkins.io/debian-stable binary/ > /etc/apt/sources.list.d/jenkins.list'
sudo apt-get update
sudo apt-get install jenkins
```

2. **Run Setup Script**
```bash
# Copy setup.groovy to Jenkins server
scp setup.groovy jenkins-server:/var/lib/jenkins/init.groovy.d/
```

3. **Configure Credentials**
In Jenkins UI, add the following credentials:
- `test-db-url`: PostgreSQL test database URL
- `jwt-secret`: JWT secret for testing
- `test-user`: Test user credentials
- `test-password`: Test user password
- `fly-token`: Fly.io authentication token
- `slack-token`: Slack notification token

## Pipeline Configuration

1. **Create New Pipeline**
- Click "New Item"
- Select "Pipeline"
- Name it "fiserv-inventory"

2. **Configure Pipeline**
- Select "Pipeline script from SCM"
- Set SCM to Git
- Enter repository URL
- Set branch to */main
- Set script path to "Jenkinsfile"

## Environment Variables
Required environment variables in Jenkins:
```
NODE_VERSION=18.x
FLYCTL_VERSION=0.1.76
TEST_DB_URL=${test-db-url}
JWT_SECRET=${jwt-secret}
TEST_USER=${test-user}
TEST_PASSWORD=${test-password}
```

## Pipeline Stages

1. **Setup**
- Installs Node.js and Fly.io CLI
- Installs project dependencies

2. **Lint**
- Runs code linting

3. **Tests**
- Unit Tests
- Integration Tests
- E2E Tests

4. **Build**
- Builds the application

5. **Deploy**
- Staging (develop branch)
- Production (main branch, requires approval)

## Monitoring

- Test results available in "Test Results" section
- Coverage reports in "Coverage Report"
- Build status notifications in Slack

## Maintenance

1. **Backup Jenkins**
```bash
sudo cp -r /var/lib/jenkins /backup/jenkins-backup
```

2. **Update Jenkins**
```bash
sudo apt-get update
sudo apt-get upgrade jenkins
```

3. **Clean Workspace**
- Pipeline automatically cleans workspace after each run
- Manual cleanup: `jenkins-cleanup.sh`

## Troubleshooting

1. **Build Failures**
- Check console output
- Verify environment variables
- Check test database connection
- Verify Fly.io authentication

2. **Deployment Issues**
- Check Fly.io credentials
- Verify deployment configuration
- Check network connectivity

3. **Test Failures**
- Review test logs
- Check test database state
- Verify test environment configuration 