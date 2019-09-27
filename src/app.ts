import express, { Router } from "express";
import { AddressInfo } from "net";

export interface IController {
    router: Router;
}

class App {
    public app: express.Application;

    constructor(controllers: IController[]) {
        this.app = express();
        this.initializeControllers(controllers);
    }

    public listen(port: string) {
        this.app.set("port", port);
        const server = this.app.listen(this.app.get("port"), () => {
            console.log(
                `Express running → PORT ${
                    (server.address() as AddressInfo).port
                }`
            );
        });
    }

    private initializeControllers(controllers: IController[]) {
        controllers.forEach(controller => {
            this.app.use("/", controller.router);
        });
    }
}

export default App;
