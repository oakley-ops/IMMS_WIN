import jenkins.model.*
import hudson.security.*
import jenkins.security.s2m.AdminWhitelistRule

def instance = Jenkins.getInstance()

// Install required plugins
def pluginList = [
    'git',
    'workflow-aggregator',
    'nodejs',
    'credentials-binding',
    'junit',
    'htmlpublisher',
    'slack',
    'docker',
    'blueocean'
]

def pm = instance.getPluginManager()
def uc = instance.getUpdateCenter()
def installed = false

pluginList.each { plugin ->
    if (!pm.getPlugin(plugin)) {
        def installFuture = uc.getPlugin(plugin).deploy()
        installed = true
    }
}

if (installed) {
    instance.save()
    instance.doSafeRestart()
}

// Configure security
def strategy = new FullControlOnceLoggedInAuthorizationStrategy()
instance.setAuthorizationStrategy(strategy)

def realm = new HudsonPrivateSecurityRealm(false)
instance.setSecurityRealm(realm)

// Create admin user
def user = realm.createAccount('admin', 'your-secure-password')
user.save()

// Configure Slack notifications
def slackConfig = new jenkins.plugins.slack.SlackNotifier.DescriptorImpl()
slackConfig.setTeamDomain('your-workspace')
slackConfig.setTokenCredentialId('slack-token')
slackConfig.save()

// Configure Node.js
def nodeJSInstallation = new jenkins.plugins.nodejs.NodeJSInstallation(
    'NodeJS 18.x',
    '/usr/local/bin/node',
    [new jenkins.plugins.nodejs.tools.NodeJSInstaller('18.17.1')]
)

def nodeJSPlugin = instance.getDescriptorByType(jenkins.plugins.nodejs.NodeJSInstallation.DescriptorImpl)
nodeJSPlugin.setInstallations(nodeJSInstallation)
nodeJSPlugin.save()

// Save configuration
instance.save() 