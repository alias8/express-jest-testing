import bodyParser from "body-parser";
import flash from "connect-flash";
import mongo from "connect-mongo";
import cookieParser from "cookie-parser";
import { promisify } from "es6-promisify";
import express, { Router } from "express";
import session from "express-session";
import expressValidator from "express-validator";
import mongoose from "mongoose";
import { AddressInfo } from "net";
import passport from "passport";

import * as errorHandlers from "./handlers/errorHandlers";
import { User } from "./models/User";
import { performance } from "perf_hooks";

export interface IController {
    router: Router;
}

class App {
    public app: express.Application;
    private databaseConnected: boolean = false;

    constructor(controllers: IController[]) {
        this.app = express();
        this.app.set("port", process.env.PORT);

        this.setupPassport();
        this.initializeLogins();
        this.setupMiddleware();
        this.initializeControllers(controllers);
        this.initializeErrorHandling();
    }

    public listen() {
        const server = this.app.listen(this.app.get("port"), () => {
            console.log(
                `Express running → PORT ${
                    (server.address() as AddressInfo).port
                }`
            );
        });
    }

    public async connectToTheDatabase() {
        if(this.databaseConnected) {
            return;
        }
        const t0 = performance.now();
        mongoose.Promise = global.Promise;
        return mongoose
          .connect(process.env.DATABASE || "", {
              useCreateIndex: true,
              useNewUrlParser: true
          })
          .then(() => {
              this.databaseConnected = true;
              const t1 = performance.now();
              console.log("Call to connectdatabase took " + (t1 - t0) + " milliseconds.");
              /** ready to use. The `mongoose.connect()` promise resolves to undefined. */
          })
          .catch(err => {
              console.log(
                "MongoDB connection error. Please make sure MongoDB is running. " +
                err
              );
          });
    }

    private setupPassport() {
        passport.use(User.createStrategy());
        passport.serializeUser(User.serializeUser());
        passport.deserializeUser(User.deserializeUser());
    }

    private initializeLogins() {
        const MongoStore = mongo(session);
        // Sessions allow us to store data on visitors from request to request
        // This keeps users logged in and allows us to sendEmail flash messages
        this.app.use(
          session({
              name: process.env.KEY,
              resave: false,
              saveUninitialized: false,
              secret: process.env.SECRET || "",
              store: new MongoStore({
                  mongooseConnection: mongoose.connection
              })
          })
        );

        // promisify some callback based APIs
        this.app.use((req, res, next) => {
            (req as any).login = promisify(req.login.bind(req));
            next();
        });
    }

    private setupMiddleware() {
        // Takes the raw requests and turns them into usable properties on req.body
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));

        // Exposes a bunch of methods for validating data. Used heavily on userController.validateRegister
        this.app.use(expressValidator());

        // populates req.cookies with any cookies that came along with the request
        this.app.use(cookieParser());

        // // Passport JS is what we use to handle our logins
        this.app.use(passport.initialize());
        this.app.use(passport.session());

        // pass variables to our templates + all requests
        this.app.use((req, res, next) => {
            next();
        });
    }

    private initializeControllers(controllers: IController[]) {
        controllers.forEach(controller => {
            this.app.use("/", controller.router);
        });
    }

    private initializeErrorHandling() {
        // If that above routes didnt work, we 404 them and forward to error handler
        this.app.use(errorHandlers.notFound);

        // One of our error handlers will see if these errors are just validation errors
        this.app.use(errorHandlers.flashValidationErrors);

        // Otherwise this was a really bad error we didn't expect! Shoot eh
        if (this.app.get("env") === "development") {
            /* Development Error Handler - Prints stack trace */
            this.app.use(errorHandlers.developmentErrors);
        }

        // production error handler
        this.app.use(errorHandlers.productionErrors);
    }
}

export default App;
