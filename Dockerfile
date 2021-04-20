FROM node:14

EXPOSE 7890

WORKDIR /app

ADD . /app

RUN yarn install

CMD yarn start
