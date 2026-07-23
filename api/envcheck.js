/* TEMPORARY diagnostic — reports which env vars the live function can see.
   Never returns the secret values, only presence/length and the key names.
   Delete this file once the admin setup is confirmed working. */
'use strict';

module.exports = (req, res) => {
    const relevantKeys = Object.keys(process.env)
        .filter(function (k) { return /GITHUB|ADMIN|TOKEN|PASS/i.test(k); })
        .sort();

    res.status(200).json({
        hasAdminPassword: !!process.env.ADMIN_PASSWORD,
        adminPasswordLen: (process.env.ADMIN_PASSWORD || '').length,
        hasGithubToken: !!process.env.GITHUB_TOKEN,
        githubTokenLen: (process.env.GITHUB_TOKEN || '').length,
        relevantKeyNames: relevantKeys
    });
};
