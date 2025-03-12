import { RequestHandler } from "express";

export const pingController:RequestHandler = (req, res) => {
    res.json({pong: true})
}