// HARNESS: BiogFile's question-parsing loop, sliced VERBATIM from
// Assets/Scripts/API/BiogFile.cs (constructor body from "// Parse text into questions"
// through "reader.Close();") plus its verbatim nested Question/Answer classes.
// The only edits are: the file bytes are supplied by the caller instead of FileProxy,
// and characterDocument.classIndex becomes an int parameter. No parsing statement altered.
using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

public class BiogParse
{
    const int questionCount = 12;
    const int defaultBackstoriesStart = 4116;
    public int backstoryId;
    public Question[] questions = new Question[questionCount];

    public BiogParse(string questionsStr, string fileName, int classIndex)
    {
            // Parse text into questions
            StringReader reader = new StringReader(questionsStr);
            string curLine = reader.ReadLine();
            for (int i = 0; i < questionCount; i++)
            {
                questions[i] = new Question();

                // Skip through any blank lines
                while (curLine.Length <= 1)
                    curLine = reader.ReadLine();

                // If we haven't parsed the first question yet, allow users to specify a custom backstory string id
                if(i == 0)
                {
                    if (curLine[0] == '#')
                    {
                        string value = curLine.Substring(1);
                        if (!int.TryParse(value, out backstoryId))
                        {
                            Debug.LogError($"{fileName}: Invalid string id '{value}'");
                            backstoryId = defaultBackstoriesStart + classIndex;
                        }

                        // Find the next non-empty line, which should be question 1
                        do
                        {
                            curLine = reader.ReadLine();
                        } while (curLine.Length <= 1);
                    }
                    else
                    {
                        backstoryId = defaultBackstoriesStart + classIndex;
                    }
                }

                // Parse question text
                for (int j = 0; j < Question.lines; j++)
                {
                    // Check if the next line is part of the question
                    if (j == 0) // first question line should lead with a number followed by a '.'
                    {
                        questions[i].Text[j] = curLine.Split(new[] { '.' }, 2)[1].Trim();
                    }
                    else if (j > 0 && curLine.IndexOf(".") != 1 && curLine.IndexOf(".") != 2)
                    {
                        questions[i].Text[j] = curLine.Trim();
                    }
                    else
                    {
                        break;
                    }
                    curLine = reader.ReadLine();
                }
                // Parse answers to the current question
                while (curLine.IndexOf(".") == 1 && char.IsLetter(curLine[0])) // Line without 2-char preamble including letter = end of answers
                {
                    Answer ans = new Answer();
                    // Get Answer text
                    ans.Text = curLine.Split('.')[1].Trim();
                    curLine = reader.ReadLine();

                    // Add answer effects
                    while (curLine.IndexOf(".") != 1 && curLine.Length > 1)
                    {
                        ans.Effects.Add(curLine.Trim());
                        curLine = reader.ReadLine();
                    }
                    questions[i].Answers.Add(ans);
                }
            }
            reader.Close();
    }

        public class Question
        {
            public const int lines = 2;
            //const int maxAnswers = 10;

            readonly string[] text = new string[lines];
            readonly List<Answer> answers = new List<Answer>();

            public Question()
            {
                for (int i = 0; i < lines; i++)
                {
                    text[i] = string.Empty;
                }
            }

            public string[] Text
            {
                get { return text; }
            }

            public List<Answer> Answers
            {
                get { return answers; }
            }
        }

        public class Answer
        {
            string text = string.Empty;
            readonly List<string> effects = new List<string>();

            public string Text
            {
                get { return text; }
                set { text = value; }
            }

            public List<String> Effects
            {
                get { return effects; }
            }
        }


}
