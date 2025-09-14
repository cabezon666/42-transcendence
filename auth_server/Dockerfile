FROM node:20-alpine

# Install netcat for health checks and su-exec for user switching
RUN apk add --no-cache netcat-openbsd su-exec

# Create app directory
WORKDIR /app

# Create a non-privileged user that the app will run under.
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Don't switch to nodejs user yet - let entrypoint handle it
# USER nodejs

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "start"]