import { FlexCol } from "@components/Flex";
import AdventureHandling from "./AdventureHandling";
import UserHandling from "./UserHandling";
import ClassHandling from "./CharacterClassHandling";
import { useUtilContext } from "@contexts/utilContext";
import { useEffect } from "preact/compat";
import AdminRestDataHandling from "./AdminRestHandling";

function Admin() {
  const { setDisableNavArrows } = useUtilContext();

  useEffect(
    () =>
      setDisableNavArrows({
        left: false,
        right: false,
      }),
    []
  );
  return (
    <FlexCol className="w-full h-full max-w-full max-h-full p-1 fancy-container gap-2 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden">
      <div className="grid grid-cols-1 min-[1200px]:grid-cols-2 w-full min-w-0 items-start gap-2">
        <div className="w-full min-w-0 max-w-full overflow-hidden">
          <UserHandling />
        </div>
        <div className="w-full min-w-0 max-w-full overflow-hidden">
          <AdventureHandling />
        </div>
      </div>
      <hr className="fancy m-1" />
      <div className="relative z-10 w-full min-w-0 overflow-visible">
        <ClassHandling />
      </div>
      <hr className="fancy m-1" />
      <div className="relative z-0 w-full min-w-0 pt-2">
        <AdminRestDataHandling />
      </div>
    </FlexCol>
  );
}

export default Admin;

