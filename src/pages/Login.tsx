import { useEffect, useRef } from "preact/hooks";
import { FlexCol } from "@components/Flex";
import { useUtilContext } from "@contexts/utilContext";
import { useDataContext } from "@contexts/dataContext";
import useRequest from "@hooks/request";
import useError from "@hooks/error";
import { Application, User } from "@shared/contracts";
import { CheckBoxUnq } from "@components/GeneralElements";
import { getCookie, setCookie } from "@utils/common";
import { debugLog } from "@/core/logger";

export function LoginForm(props: { loginToInterface: () => void }) {
  const pwdRef = useRef<HTMLInputElement>(null);
  const usrRef = useRef<HTMLInputElement>(null);
  const keepLoggedRef = useRef<HTMLInputElement>(null);

  const { setDisableNavArrows } = useUtilContext();
  const { setUser } = useDataContext();
  const [ requestUser ] = useRequest(Application.REQUEST_CONTROLLER.USERS);
  const { setError } = useError();

  useEffect(() => {
    if (getCookie("keepLogged") === "true") {
      requestUser<User.IUserDataServer>({
        endPoint: "/login",
        body: {
          jwt: true
        }
      })
        .then((response) => {
          if (response.data.uid) {
            setUser(response.data);
            props.loginToInterface();
          }
        })
        .catch(() => {
          // Silent fail: no valid JWT cookie is normal after explicit logout.
        });
    }
  }, []);

  useEffect(() => setDisableNavArrows({ left: true, right: true }), []);

  return (
    <form
      className="flex flex-col justify-center items-center w-60 lg:w-80 h-40 self-center fancy-container gap-1"
      id="login-form"
      onSubmit={(e) => {
        e.preventDefault(); // Prevent the default form submission
        if (!usrRef.current?.value || !pwdRef.current?.value) return;
        requestUser<User.IUserDataServer>({
          endPoint: "/login",
          body: {
            uid: usrRef.current.value,
            pwd: pwdRef.current.value,
            keepLogged: keepLoggedRef.current?.checked || false,
          },
        })
          .then((response) => {
            if (response.data.json.rank === User.USER_RANK.UNAUTH) {
              setError("Invalid login credentials");
              return;
            }
            setUser(response.data);
            props.loginToInterface();
          })
          .catch((error) => {
            setError("Failed to login: " + error);
            debugLog("Failed to login:", error);
          });
      }}
    >
      <FlexCol>
        <label
          for="name"
          className="m-0.5 font-bold text-center select-none text-white"
        >
          UID
        </label>
        <input
          id="name"
          type="text"
          name="name"
          className="py-[3px] px-[7px] w-40 lg:w-60 rounded-md text-center"
          ref={usrRef}
        />
      </FlexCol>
      <FlexCol>
        <label
          for="password"
          className="m-0.5 font-bold text-center select-none text-white"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          className="py-[3px] px-[7px] w-40 lg:w-60 rounded-md text-center"
          ref={pwdRef}
        />
      </FlexCol>
      <FlexCol>
        <CheckBoxUnq
          id="remember"
          label="Remember me"
          widthOverride="w-full px-2"
          ref={keepLoggedRef}
          onChange={(e) => {
            setCookie("keepLogged",Boolean(e.currentTarget.checked).toString(),30);
          }}
          value={false}
        />
        <button className="py-[3px] px-[7px] w-40 lg:w-60">Submit</button>
      </FlexCol>
    </form>
  );
}





