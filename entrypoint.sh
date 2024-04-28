#!/bin/sh -e
echo "Setting cron expression to $runningCron"

# The cron expression and commnad
echo "$runningCron /usr/local/bin/node /usr/src/app/document-control.js" >> /etc/crontabs/node

# Whiteline to make it a valid crontab
echo "" >> /etc/crontabs/node

# Set permissions
chmod 644 /etc/crontabs/node

# Make it a crontab
crontab -u node /etc/crontabs/node


# Start the cron daemon as only task of this container
/usr/sbin/crond -f -l 0 &

# Keep the container running by adding a foreground process
tail -f /dev/null
