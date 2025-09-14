# Use the official Node.js runtime as the base image
FROM node:lts-alpine3.22

# Install su-exec for user switching
RUN apk add --no-cache su-exec

# Set the working directory in the container
WORKDIR /app

# Create a non-root user to run the application
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Change ownership of the app directory to the nodejs user
RUN chown -R nodejs:nodejs /app
# Don't switch to nodejs user yet - let entrypoint handle it
# USER nodejs

# Expose the port the app runs on
EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "start"]
