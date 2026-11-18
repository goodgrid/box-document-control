FROM node:26-alpine3.24

# The container runs the job from cron, so the image timezone determines when
# the schedule in $runningCron actually fires. Keep tzdata installed: removing
# it deletes /usr/share/zoneinfo, which silently degrades any TZ lookup to UTC.
RUN apk add --no-cache tzdata
ENV TZ=Europe/Amsterdam
RUN cp /usr/share/zoneinfo/$TZ /etc/localtime && echo "$TZ" > /etc/timezone

WORKDIR /usr/src/app

# npm ci installs exactly what package-lock.json pins, so a rebuild of this
# image cannot quietly pull in different dependency versions.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENTRYPOINT ["./entrypoint.sh"]
