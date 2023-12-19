import { useNavigate, useParams } from "react-router-dom"
import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/widgets/breadcrumb"
import apiBaseUrl from "@/lib/api-base-url"
import { useEffect, useMemo, useRef, useState } from "react"
import TopBar from "@/components/widgets/top-bar"
import TopBarActions from "@/components/widgets/top-bar-actions"
import MainArea from "@/components/widgets/main-area"
import MainContent from "@/components/widgets/main-content"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { z } from "zod"
import { REGEX_IDENTIFIER, REGEX_IDENTIFIER_MESSAGE, cn } from "@/lib/utils"
import { SubmitHandler, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  MainContainer,
  Section,
  SectionBody,
} from "@/components/widgets/main-container"
import Editor, { OnMount, loader } from "@monaco-editor/react"
import type monaco from "monaco-editor"
import { Input } from "@/components/ui/input"
import DeleteComposeDialog from "./dialogs/delete-compose-dialog"
import useFileSystemComposeLibraryItem from "@/hooks/useFileSystemComposeLibraryItem"
import useComposeLibraryItemList from "@/hooks/useComposeLibraryItemList"
import { toast } from "@/components/ui/use-toast"
import { useTheme } from "@/components/ui/theme-provider"

export default function EditFileSystemComposeProject() {
  const { composeProjectName } = useParams()
  const {
    fileSystemComposeLibraryItem: composeLibraryItem,
    mutateFileSystemComposeLibraryItem,
  } = useFileSystemComposeLibraryItem(composeProjectName!)
  const { mutateComposeLibraryItemList } = useComposeLibraryItemList()
  const [isSaving, setIsSaving] = useState(false)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>()
  const [editorMounted, setEditorMounted] = useState(1)
  const navigate = useNavigate()
  const { theme } = useTheme()

  const formSchema = z.object({
    newProjectName: z
      .string()
      .min(1, "Name is required")
      .max(20)
      .regex(REGEX_IDENTIFIER, REGEX_IDENTIFIER_MESSAGE)
      .refine(async (value) => {
        const res = await fetch(
          `${apiBaseUrl()}/composelibrary/uniquenameexcludeitself?newvalue=${value}&currentvalue=${composeLibraryItem?.projectName}`
        )
        return (await res.json()).unique
      }, "Another project with this name already exists"),
    definition: z.string().optional(),
  })

  type FormSchemaType = z.infer<typeof formSchema>

  const form = useForm<FormSchemaType>({
    resolver: zodResolver(formSchema),
    defaultValues: useMemo(() => {
      if (!composeLibraryItem || !composeLibraryItem.projectName)
        return { newProjectName: "", definition: "" }

      editorRef.current?.setValue(composeLibraryItem?.definition!)

      return {
        newProjectName: composeLibraryItem.projectName,
        definition: composeLibraryItem.definition,
      }
    }, [composeLibraryItem]),
  })

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    data.definition = editorRef.current?.getValue()
    setIsSaving(true)
    const response = await fetch(
      `${apiBaseUrl()}/composelibrary/filesystem/${composeProjectName}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    )
    if (!response.ok) {
      toast({
        variant: "destructive",
        title: "Something went wrong.",
        description:
          "There was a problem when saving the definition. Try again!",
      })
    } else {
      mutateFileSystemComposeLibraryItem()
      mutateComposeLibraryItemList()
      toast({
        title: "Success!",
        description: "Definition has been saved.",
      })
      navigate(`/composelibrary/filesystem/${data.newProjectName}/edit`)
    }
    setIsSaving(false)
  }

  useEffect(() => {
    form.reset({
      newProjectName: composeLibraryItem?.projectName,
      definition: composeLibraryItem?.definition,
    })
    if (composeLibraryItem?.definition && editorRef.current) {
      editorRef.current.setValue(composeLibraryItem.definition)
    }
  }, [composeLibraryItem, editorMounted])

  const handleEditorDidMount: OnMount = (editor, _monaco) => {
    editorRef.current = editor
    setEditorMounted(editorMounted + 1)
  }

  loader.init().then((monaco) => {
    monaco.editor.defineTheme("dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#000000",
      },
    })
  })

  return (
    <MainArea>
      <TopBar>
        <Breadcrumb>
          <BreadcrumbLink to="/composelibrary">Compose Library</BreadcrumbLink>
          <BreadcrumbSeparator />
          <BreadcrumbCurrent>{composeProjectName}</BreadcrumbCurrent>
          <BreadcrumbSeparator />
          <BreadcrumbCurrent>Edit</BreadcrumbCurrent>
        </Breadcrumb>
        <TopBarActions></TopBarActions>
      </TopBar>
      <div className="-mb-8 pt-4">
        <Button
          className="mb-4 mr-2 w-24"
          onClick={form.handleSubmit(onSubmit)}
        >
          Save
        </Button>
        <DeleteComposeDialog />
      </div>
      <MainContent>
        <MainContainer>
          <Section>
            <SectionBody>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <fieldset className={cn("group")} disabled={isSaving}>
                    <div className="max-w-2xl pb-4">
                      <FormField
                        control={form.control}
                        name="newProjectName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div>
                      <FormLabel className="block pb-4">Definition</FormLabel>
                      <Editor
                        theme={theme}
                        height="50vh"
                        defaultLanguage="yaml"
                        defaultValue=""
                        options={{ minimap: { enabled: false } }}
                        onMount={handleEditorDidMount}
                      />
                    </div>
                  </fieldset>
                </form>
              </Form>
            </SectionBody>
          </Section>
        </MainContainer>
      </MainContent>
    </MainArea>
  )
}