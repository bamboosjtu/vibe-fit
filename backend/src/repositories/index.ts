import { env } from "../config/env.js";
import { mockRepositories } from "./mock.js";
import { postgresRepositories } from "./postgres.js";

export const repositories =
  env.DATA_MODE === "postgres" ? postgresRepositories : mockRepositories;
