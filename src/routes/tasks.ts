import Router from "express";
import {
  handleAddTaskQuery,
  handleDeleteTaskQuery,
  handleGetTasksQuery,
  markTaskAsDone,
  editTaskDescription,
} from "../tasks";

export const taskRouter = Router();
taskRouter.get("/", handleGetTasksQuery);
taskRouter.post("/", handleAddTaskQuery);
taskRouter.put("/:id", markTaskAsDone);
taskRouter.patch("/:id", editTaskDescription);
taskRouter.delete("/:id", handleDeleteTaskQuery);
