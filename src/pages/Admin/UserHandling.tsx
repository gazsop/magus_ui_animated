import { SingleValue } from "react-select";
import { Application, User } from "@shared/contracts";
import { FlexCol } from "@components/Flex";
import {
  ButtonUnq,
  HTMLOptionData,
  InputUnq,
  SelectUnq,
} from "@components/GeneralElements";
import { useEffect } from "preact/hooks";
import { useState } from "preact/hooks";
import useRequest from "@hooks/request";
import useError from "@hooks/error";
import { debugLog } from "@/core/logger";
import { isConflictError } from "@/core/api/httpClient";

function UserHandling() {
  type TAdminUser = User.IUserDataClient & { hash?: string };
  const [users, setUsers] = useState<TAdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<number>(-1);
  const [pwd, setPwd] = useState<string>("");
  const [display, setDisplay] = useState<boolean>(true);
  const [rank, setRank] = useState<User.USER_RANK>(User.USER_RANK.USER);

  const [requestUser] = useRequest(Application.REQUEST_CONTROLLER.USERS);
  const { setError } = useError();

  const reportRequestError = (message: string, error: unknown) => {
    setError(`${message}: ${error}`);
    debugLog(message, error);
  };

  useEffect(() => {
    getAllUsers();
  }, []);

  useEffect(() => {
    if (selectedUser === -1 && users.length > 0) setSelectedUser(0);
  }, [users]);

  useEffect(() => {
    if (selectedUser === 0) {
      setRank(User.USER_RANK.USER);
      return;
    }
    if (selectedUser > 0 && users[selectedUser]?.rank) {
      const userRank = users[selectedUser].rank;
      if (userRank === User.USER_RANK.ADMIN || userRank === User.USER_RANK.USER) {
        setRank(userRank);
      } else {
        setRank(User.USER_RANK.USER);
      }
    }
  }, [selectedUser, users]);

  const isEmptySelection = selectedUser < 0 || users.length === 0;
  const isNewSelection = !isEmptySelection && selectedUser === 0;
  const isExistingSelection = !isEmptySelection && selectedUser > 0;
  const selectedUserData = !isEmptySelection ? users[selectedUser] : null;

  function getAllUsers() {
    requestUser<TAdminUser[]>({
      endPoint: "/getAll",
    })
      .then((response) => {
        setUsers([
          {
            uid: "",
            name: "",
            isAdmin: false,
            rank: User.USER_RANK.UNAUTH,
          },
          ...response.data,
        ]);
        setPwd("");
      })
      .catch((error) => {
        reportRequestError("Failed to fetch users", error);
      });
  }

  if (users.length === 0) return <FlexCol></FlexCol>;
  return (
    <FlexCol className="w-full min-w-0">
      <label onClick={() => setDisplay(!display)} className={`text-center`}>
        USERS
      </label>
      {display && (
        <>
          <SelectUnq
            id={"admin-userSelect"}
            label={"Felhasználó kiválasztása"}
            value={
              isEmptySelection
                ? {
                    label: "",
                    value: "",
                  }
                : isNewSelection
                ? {
                    label: selectedUserData?.name || "Új felhasználó",
                    value: selectedUserData?.uid || "new",
                  }
                : {
                    label: selectedUserData?.name || "",
                    value: selectedUserData?.uid || "",
                  }
            }
            onChange={(e: SingleValue<HTMLOptionData<string>>) => {
              if (!e) return;
              const userIndex = users.findIndex((user) => user.uid === e.value);
              if (userIndex === 0 && selectedUser !== 0) {
                setUsers((prev) =>
                  prev.map((user, index) =>
                    index === 0
                      ? {
                          uid: "",
                          name: "",
                          isAdmin: false,
                          rank: User.USER_RANK.UNAUTH,
                        }
                      : user
                  )
                );
                setRank(User.USER_RANK.USER);
              }
              setSelectedUser(userIndex === -1 ? 0 : userIndex);
              setPwd("");
            }}
            optionData={[
              ...users.map((user, index) => {
                if (index === 0)
                  return {
                    label: "Új felhasználó",
                    value: "new",
                  };
                return {
                  label: user.name,
                  value: user.uid,
                };
              }),
            ]}
            className="m-1"
            disabled={false}
          />
          <InputUnq
            id={"admin-uid"}
            label={"UID"}
            value={isEmptySelection ? "" : selectedUserData?.uid || ""}
            onBlur={(e) => {
              if (isEmptySelection) return;
              const elem = e.target as HTMLInputElement;
              const val = elem.value as string;
              setUsers((prev) =>
                prev.map((user, index) =>
                  index === selectedUser ? { ...user, uid: val } : user
                )
              );
            }}
            className="m-1"
            disabled={isEmptySelection}
          />
          <InputUnq
            id={"admin-name"}
            label={"Name"}
            value={isEmptySelection ? "" : selectedUserData?.name || ""}
            onBlur={(e) => {
              if (isEmptySelection) return;
              const elem = e.target as HTMLInputElement;
              const val = elem.value as string;
              setUsers((prev) =>
                prev.map((user, index) =>
                  index === selectedUser ? { ...user, name: val } : user
                )
              );
            }}
            className="m-1"
            disabled={isEmptySelection}
          />
          <InputUnq
            id={"admin-pwd"}
            label={"Pwd"}
            value={pwd}
            type="password"
            className="m-1"
            placeholder={isNewSelection ? "********" : ""}
            onInput={(e) => {
              const elem = e.target as HTMLInputElement;
              const val = elem.value as string;
              setPwd(val);
            }}
            disabled={isEmptySelection}
          />
          <SelectUnq
            id={"admin-rank"}
            label={"Rank"}
            value={{
              label: rank,
              value: rank,
            }}
            optionData={[
              { label: User.USER_RANK.USER, value: User.USER_RANK.USER },
              { label: User.USER_RANK.ADMIN, value: User.USER_RANK.ADMIN },
            ]}
            onChange={(e: SingleValue<HTMLOptionData<User.USER_RANK>>) => {
              if (!e) return;
              setRank(e.value);
              if (isExistingSelection) {
                setUsers((prev) =>
                  prev.map((user, index) =>
                    index === selectedUser ? { ...user, rank: e.value } : user
                  )
                );
              }
            }}
            className="m-1"
            disabled={isEmptySelection}
          />
          <FlexCol className="flex-wrap">
            <ButtonUnq
              id={"admin-get-all"}
              onClick={() => getAllUsers()}
              className="m-1"
            >
              GET ALL USERS
            </ButtonUnq>
            <ButtonUnq
              id={"admin-update"}
              onClick={() => {
                if (!isExistingSelection || !selectedUserData) return;
                const body: User.IUserDataClient = {
                  uid: selectedUserData.uid,
                  name: selectedUserData.name,
                  isAdmin: rank === User.USER_RANK.ADMIN,
                  rank,
                };
                if (pwd) body.pwd = pwd;
                requestUser({
                  endPoint: "/update",
                  body: {
                    uid: selectedUserData.uid,
                    expectedHash: selectedUserData.hash,
                    patch: [
                      { op: "replace", path: "/name", value: body.name },
                      { op: "replace", path: "/json/isAdmin", value: body.isAdmin },
                      { op: "replace", path: "/json/rank", value: body.rank },
                      ...(body.pwd ? [{ op: "replace", path: "/pwd", value: body.pwd }] : []),
                    ],
                  },
                })
                  .then(() => {
                    setPwd("");
                    getAllUsers();
                  })
                  .catch((error) => {
                    if (isConflictError(error)) {
                      getAllUsers();
                      setError("Conflict (409): user changed on server. Reloaded latest data, please retry.");
                      return;
                    }
                    reportRequestError("Failed to update user", error);
                  });
              }}
              className="m-1"
              disabled={!isExistingSelection}
            >
              UPDATE USER
            </ButtonUnq>
            <ButtonUnq
              id={"admin-delete"}
              onClick={() => {
                if (!isExistingSelection || !selectedUserData) return;
                if (!confirm("Are you sure you want to delete this user?"))
                  return;
                requestUser({
                  endPoint: "/delete",
                  body: {
                    uid: selectedUserData.uid,
                  },
                })
                  .then(() => {
                    setPwd("");
                    getAllUsers();
                  })
                  .catch((error) => {
                    reportRequestError("Failed to delete user", error);
                  });
              }}
              className="m-1"
              disabled={!isExistingSelection}
            >
              DELETE USER
            </ButtonUnq>
            <ButtonUnq
              id={"admin-create"}
              onClick={() => {
                if (!isNewSelection || !selectedUserData) return;
                const body: User.IUserDataClient = {
                  uid: selectedUserData.uid,
                  name: selectedUserData.name,
                  isAdmin: rank === User.USER_RANK.ADMIN,
                  rank,
                };
                if (pwd) {
                  body.pwd = pwd;
                }
                if (body.uid === "new") {
                  setError("Please enter a UID");
                  return;
                }
                if (!body.pwd) {
                  setError("Please enter a password");
                  return;
                }
                if (!body.name) {
                  setError("Please enter a name");
                  return;
                }
                requestUser({
                  endPoint: "/create",
                  body: body,
                })
                  .then(() => {
                    setPwd("");
                    getAllUsers();
                  })
                  .catch((error) => {
                    reportRequestError("Failed to create user", error);
                  });
              }}
              className="m-1"
              disabled={!isNewSelection}
            >
              CREATE USER
            </ButtonUnq>
          </FlexCol>
        </>
      )}
    </FlexCol>
  );
}

export default UserHandling;






