import { Button } from "@/components/ui/button";

const FileSelector: React.FC = () => {
    return(
        <>
        <h1>Welcome</h1>
        <Button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" variant="default" size="default">
            Click Me
        </Button>
        </>
    )
}

export default FileSelector;